/**
 * Streamix Backend — Main Server
 * Express API for IPTV content: Live TV, Movies, Series
 * Stack: Node.js + Express + node-cache + node-cron
 * Deploy free on: Railway.app / Render.com / Fly.io
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const NodeCache  = require('node-cache');
const cron       = require('node-cron');

const { fetchAllSources, buildCarousels, getFeatured } = require('./parsers/m3uParser');
const { fetchAllEPG, enrichWithEPG, getCurrentProgram } = require('./parsers/epgParser');
const { batchEnrich } = require('./services/tmdbService');
const { FREE_EPG_SOURCES } = require('./parsers/m3uParser');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────────────────────────
// IN-MEMORY DATABASE
// In production, replace with Supabase (free) or SQLite
// ─────────────────────────────────────────────────────────────────
let contentDB = {
  live:    [],
  movies:  [],
  series:  [],
  epg:     { channels: new Map(), programs: new Map() },
  lastUpdated: null,
  isReady: false,
};

// Multi-level cache: L1=hot (1min), L2=warm (5min), L3=cold (1hr)
const cacheL1 = new NodeCache({ stdTTL: 60 });
const cacheL2 = new NodeCache({ stdTTL: 300 });
const cacheL3 = new NodeCache({ stdTTL: 3600 });

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Rate limiting — prevents abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en 15 minutos.' },
});
app.use('/api/', limiter);

// ─────────────────────────────────────────────────────────────────
// CACHE HELPER
// ─────────────────────────────────────────────────────────────────
function cached(key, fn, ttl = 300) {
  return async (req, res) => {
    const cacheKey = `${key}:${JSON.stringify(req.query)}`;

    // Check caches L1 → L2 → L3
    let data = cacheL1.get(cacheKey) || cacheL2.get(cacheKey) || cacheL3.get(cacheKey);
    if (data !== undefined) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(data);
    }

    try {
      data = await fn(req, res);
      if (data !== undefined) {
        cacheL2.set(cacheKey, data, ttl);
        res.setHeader('X-Cache', 'MISS');
        return res.json(data);
      }
    } catch (err) {
      console.error(`[API] Error in ${key}:`, err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// PAGINATION HELPER
// ─────────────────────────────────────────────────────────────────
function paginate(items, query) {
  const page  = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
  const start = (page - 1) * limit;
  const total = items.length;

  return {
    items:      items.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  };
}

// ─────────────────────────────────────────────────────────────────
// FILTER HELPER
// ─────────────────────────────────────────────────────────────────
function filterContent(items, query) {
  let filtered = [...items];

  if (query.search) {
    const q = query.search.toLowerCase();
    filtered = filtered.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.tvgName || '').toLowerCase().includes(q) ||
      (i.title || '').toLowerCase().includes(q) ||
      (i.synopsis || '').toLowerCase().includes(q)
    );
  }

  if (query.category) {
    filtered = filtered.filter(i =>
      (i.category || '').toLowerCase().includes(query.category.toLowerCase())
    );
  }

  if (query.quality) {
    filtered = filtered.filter(i => i.quality === query.quality);
  }

  if (query.lang) {
    filtered = filtered.filter(i => i.lang === query.lang || i.language === query.lang);
  }

  if (query.country) {
    filtered = filtered.filter(i => i.country?.toUpperCase() === query.country.toUpperCase());
  }

  if (query['4k'] === 'true') {
    filtered = filtered.filter(i => i.is4K);
  }

  return filtered;
}

// ─────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────

// Health check — used by Railway/Render to verify the app is running
app.get('/health', (req, res) => {
  res.json({
    status:       contentDB.isReady ? 'ready' : 'loading',
    lastUpdated:  contentDB.lastUpdated,
    counts: {
      live:    contentDB.live.length,
      movies:  contentDB.movies.length,
      series:  contentDB.series.length,
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ── HOME — Netflix-style carousels ────────────────────────────────
app.get('/api/home', cached('home', () => {
  if (!contentDB.isReady) return { loading: true, rows: [], featured: null };

  const carousels = buildCarousels(contentDB);
  const featured  = getFeatured(contentDB);

  return {
    featured,
    rows: carousels,
    stats: {
      live:   contentDB.live.length,
      movies: contentDB.movies.length,
      series: contentDB.series.length,
    },
  };
}, 120));

// ── LIVE TV ────────────────────────────────────────────────────────
app.get('/api/live', cached('live', (req) => {
  const filtered = filterContent(contentDB.live, req.query);

  // Sort by: country match → quality → name
  filtered.sort((a, b) => {
    const preferred = ['MX', 'ES', 'US'];
    const aScore = preferred.indexOf(a.country) !== -1 ? preferred.indexOf(a.country) : 99;
    const bScore = preferred.indexOf(b.country) !== -1 ? preferred.indexOf(b.country) : 99;
    if (aScore !== bScore) return aScore - bScore;

    const qualityOrder = { '4K': 0, '1080p': 1, '720p': 2, 'HD': 3, 'SD': 4 };
    const aq = qualityOrder[a.quality] ?? 5;
    const bq = qualityOrder[b.quality] ?? 5;
    if (aq !== bq) return aq - bq;

    return (a.name || '').localeCompare(b.name || '');
  });

  return paginate(filtered, req.query);
}, 60));

// ── LIVE TV CATEGORIES ─────────────────────────────────────────────
app.get('/api/live/categories', cached('live-categories', () => {
  const categories = {};
  for (const ch of contentDB.live) {
    const cat = ch.category || 'General';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  return Object.entries(categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}, 3600));

// ── MOVIES ─────────────────────────────────────────────────────────
app.get('/api/movies', cached('movies', (req) => {
  const filtered = filterContent(contentDB.movies, req.query);

  filtered.sort((a, b) => {
    if (a.is4K !== b.is4K) return a.is4K ? -1 : 1;
    if (a.isSpanish !== b.isSpanish) return a.isSpanish ? -1 : 1;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  return paginate(filtered, req.query);
}, 120));

// ── SERIES ─────────────────────────────────────────────────────────
app.get('/api/series', cached('series', (req) => {
  const filtered = filterContent(contentDB.series, req.query);
  return paginate(filtered, req.query);
}, 120));

// ── SINGLE ITEM ────────────────────────────────────────────────────
app.get('/api/content/:id', cached('content', (req) => {
  const { id } = req.params;
  const all = [...contentDB.live, ...contentDB.movies, ...contentDB.series];
  const item = all.find(i => i.id === id);

  if (!item) return null;

  // Attach EPG if live
  if (item.type === 'live' && item.epgId) {
    const { current, next } = getCurrentProgram(item.epgId, contentDB.epg.programs);
    return { ...item, currentProgram: current, nextProgram: next };
  }

  return item;
}, 60));

// ── EPG GUIDE FOR A CHANNEL ────────────────────────────────────────
app.get('/api/epg/:channelId', (req, res) => {
  const programs = contentDB.epg.programs.get(req.params.channelId) || [];
  const now = new Date();
  const limit = parseInt(req.query.limit) || 24;

  const upcoming = programs
    .filter(p => !p.stop || new Date(p.stop) > now)
    .slice(0, limit);

  res.json({ channelId: req.params.channelId, programs: upcoming });
});

// ── SEARCH ──────────────────────────────────────────────────────────
app.get('/api/search', cached('search', (req) => {
  if (!req.query.q) return { results: [], total: 0 };

  const q = req.query.q.toLowerCase();
  const type = req.query.type; // optional: 'live' | 'movies' | 'series'

  const sources = type === 'live'   ? contentDB.live   :
                  type === 'movies' ? contentDB.movies :
                  type === 'series' ? contentDB.series :
                  [...contentDB.live, ...contentDB.movies, ...contentDB.series];

  const results = sources
    .filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.tvgName || '').toLowerCase().includes(q) ||
      (i.title || '').toLowerCase().includes(q) ||
      (i.synopsis || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
    )
    .slice(0, 50);

  return { results, total: results.length, query: req.query.q };
}, 30));

// ── STREAM REDIRECT ────────────────────────────────────────────────
// Client requests /api/stream/:id → server resolves URL → 302 redirect
// Allows future URL rotation/validation without frontend changes
app.get('/api/stream/:id', (req, res) => {
  const { id } = req.params;
  const all = [...contentDB.live, ...contentDB.movies, ...contentDB.series];
  const item = all.find(i => i.id === id);

  if (!item || !item.url) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  // Log stream request (for analytics)
  console.log(`[STREAM] ${item.name} (${item.quality}) → ${item.type}`);

  // Redirect to actual stream URL
  res.redirect(302, item.url);
});

// ── ADMIN: FORCE REFRESH ────────────────────────────────────────────
app.post('/api/admin/refresh', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ message: 'Refresh iniciado' });
  loadAllContent().catch(console.error);
});

// ─────────────────────────────────────────────────────────────────
// CONTENT LOADER — fetches + parses all M3U and EPG
// ─────────────────────────────────────────────────────────────────
async function loadAllContent() {
  console.log('[Streamix] Loading content from all sources...');
  const startTime = Date.now();

  try {
    // Fetch M3U content and EPG in parallel
    const [rawContent, epgData] = await Promise.all([
      fetchAllSources(),
      fetchAllEPG(FREE_EPG_SOURCES),
    ]);

    // Enrich live channels with EPG data
    const liveWithEPG = enrichWithEPG(rawContent.live, epgData);

    // Optional: enrich movies/series with TMDB metadata (if API key provided)
    let enrichedMovies = rawContent.movies;
    let enrichedSeries = rawContent.series;

    if (process.env.TMDB_API_KEY) {
      console.log('[TMDB] Enriching movies and series...');
      [enrichedMovies, enrichedSeries] = await Promise.all([
        batchEnrich(rawContent.movies.slice(0, 500), 'movie'),
        batchEnrich(rawContent.series.slice(0, 200), 'series'),
      ]);
    }

    // Update database
    contentDB = {
      live:        liveWithEPG,
      movies:      enrichedMovies,
      series:      enrichedSeries,
      epg:         epgData,
      lastUpdated: new Date(),
      isReady:     true,
    };

    // Clear all caches after refresh
    cacheL1.flushAll();
    cacheL2.flushAll();
    cacheL3.flushAll();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Streamix] Content loaded in ${elapsed}s:`);
    console.log(`  Live:   ${contentDB.live.length} channels`);
    console.log(`  Movies: ${contentDB.movies.length} items`);
    console.log(`  Series: ${contentDB.series.length} items`);

  } catch (err) {
    console.error('[Streamix] Failed to load content:', err.message);
    if (!contentDB.isReady) {
      // If first load failed, mark as ready with empty data rather than hanging
      contentDB.isReady = true;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULER — refresh M3U every 6 hours, EPG every 2 hours
// ─────────────────────────────────────────────────────────────────
// Full refresh: every 6 hours at :00
cron.schedule('0 */6 * * *', () => {
  console.log('[Scheduler] Starting scheduled content refresh...');
  loadAllContent().catch(console.error);
});

// ─────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║        Streamix Backend v1.0         ║
  ║   IPTV API — Netflix style 🎬        ║
  ╠══════════════════════════════════════╣
  ║  Server:  http://localhost:${PORT}     ║
  ║  Health:  /health                    ║
  ║  API:     /api/home /api/live...     ║
  ╚══════════════════════════════════════╝
  `);

  // Load content on startup
  await loadAllContent();
});

module.exports = app;
