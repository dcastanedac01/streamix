/**
 * Streamix — M3U Parser
 * Parses M3U/M3U8 playlist files from iptv-org (open source, free)
 * Handles: HLS (.m3u8), MPEG-TS, quality detection, language detection
 */

const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

// ─────────────────────────────────────────────────────────────────
// FREE M3U SOURCES — iptv-org/iptv (MIT License, completely free)
// https://github.com/iptv-org/iptv
// ─────────────────────────────────────────────────────────────────
const FREE_SOURCES = {
  live: [
    // All channels index
    { url: 'https://iptv-org.github.io/iptv/index.m3u', label: 'All Live' },
    // Mexico
    { url: 'https://iptv-org.github.io/iptv/countries/mx.m3u', label: 'México' },
    // USA (English + Spanish)
    { url: 'https://iptv-org.github.io/iptv/countries/us.m3u', label: 'USA' },
    // Spain
    { url: 'https://iptv-org.github.io/iptv/countries/es.m3u', label: 'España' },
    // Latin America
    { url: 'https://iptv-org.github.io/iptv/countries/ar.m3u', label: 'Argentina' },
    { url: 'https://iptv-org.github.io/iptv/countries/co.m3u', label: 'Colombia' },
    // News category
    { url: 'https://iptv-org.github.io/iptv/categories/news.m3u', label: 'News' },
    // Sports
    { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', label: 'Sports' },
    // Entertainment
    { url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u', label: 'Entertainment' },
  ],
  movies: [
    { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', label: 'Movies' },
  ],
  series: [
    { url: 'https://iptv-org.github.io/iptv/categories/series.m3u', label: 'Series' },
  ],
};

// Free EPG Sources — iptv-org/epg (completely free)
// https://github.com/iptv-org/epg
const FREE_EPG_SOURCES = [
  'https://iptv-org.github.io/epg/guides/mx/tvlistings.google.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/us/tvlistings.google.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/es/movistarplus.es.epg.xml.gz',
];

// ─────────────────────────────────────────────────────────────────
// QUALITY DETECTION
// ─────────────────────────────────────────────────────────────────
function detectQuality(channel) {
  const text = `${channel.name} ${channel.url} ${channel.tvgName}`.toLowerCase();

  if (
    text.includes('4k') ||
    text.includes('uhd') ||
    text.includes('2160') ||
    text.includes('2160p') ||
    text.includes('ultra hd')
  ) return '4K';

  if (
    text.includes('1080') ||
    text.includes('fhd') ||
    text.includes('full hd') ||
    text.includes('fullhd')
  ) return '1080p';

  if (
    text.includes('720') ||
    text.includes(' hd') ||
    text.includes('.hd') ||
    text.includes('[hd]')
  ) return '720p';

  if (text.includes('480') || text.includes('sd') || text.includes('360')) return 'SD';

  return 'HD'; // assume HD if no indicator
}

// ─────────────────────────────────────────────────────────────────
// LANGUAGE DETECTION
// ─────────────────────────────────────────────────────────────────
function detectLanguage(channel) {
  // Use tvg-language attribute first
  if (channel.language) {
    const lang = channel.language.toLowerCase();
    if (lang.includes('spanish') || lang.includes('español') || lang === 'spa' || lang === 'es') return 'es';
    if (lang.includes('english') || lang === 'eng' || lang === 'en') return 'en';
    if (lang.includes('portuguese') || lang === 'por' || lang === 'pt') return 'pt';
    if (lang.includes('french') || lang === 'fra' || lang === 'fr') return 'fr';
    return lang.split(';')[0].trim().toLowerCase();
  }

  // Fallback: detect from name
  const name = (channel.name || '').toLowerCase();
  if (name.includes('español') || name.includes('espanol') || name.match(/\bes\s*\|/)) return 'es';
  if (name.match(/mexico|méxico|mx|colombia|argentina|chile|perú|peru|venezuela/)) return 'es';
  if (name.match(/spain|españa|hispano|latina/)) return 'es';
  if (name.includes('english') || name.match(/\ben\s*\|/)) return 'en';
  if (name.includes('portuguese') || name.match(/\bpt\s*\|/)) return 'pt';

  // Detect from country
  const spanishCountries = ['MX', 'ES', 'CO', 'AR', 'CL', 'VE', 'PE', 'EC', 'BO', 'PY', 'UY', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'DO', 'CU', 'PR'];
  if (channel.country && spanishCountries.includes(channel.country.toUpperCase())) return 'es';

  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────
// CATEGORY NORMALIZER
// Maps varied group-title values to standard app categories
// ─────────────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  // News
  'news': 'Noticias', 'noticias': 'Noticias', 'news & politics': 'Noticias',
  // Sports
  'sports': 'Deportes', 'deportes': 'Deportes', 'sport': 'Deportes', 'football': 'Deportes',
  'soccer': 'Deportes', 'basketball': 'Deportes',
  // Movies
  'movies': 'Películas', 'películas': 'Películas', 'peliculas': 'Películas', 'movies & tv-shows': 'Películas',
  'cine': 'Películas', 'cinema': 'Películas',
  // Series
  'series': 'Series', 'tv shows': 'Series', 'animation': 'Animación', 'animated': 'Animación',
  'kids': 'Infantil', 'children': 'Infantil', 'family': 'Infantil',
  // Entertainment
  'entertainment': 'Entretenimiento', 'variety': 'Entretenimiento',
  // Music
  'music': 'Música', 'música': 'Música', 'musical': 'Música',
  // Documentary
  'documentary': 'Documentales', 'documentales': 'Documentales', 'nature': 'Documentales',
  // Channels by country
  'mexico': 'México', 'méxico': 'México', 'usa': 'USA / International', 'us': 'USA / International',
  'spain': 'España', 'españa': 'España',
  // Adult (will be filtered)
  'xxx': 'adult', 'adult': 'adult', '+18': 'adult',
};

function normalizeCategory(groupTitle, type) {
  if (!groupTitle) return type === 'live' ? 'General' : (type === 'movies' ? 'Películas' : 'Series');

  const lower = groupTitle.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  // Title-case the original
  return groupTitle.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─────────────────────────────────────────────────────────────────
// CORE M3U PARSER
// ─────────────────────────────────────────────────────────────────
function parseM3U(content, sourceLabel = '') {
  const lines = content.split('\n');
  const channels = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Extract duration
      const durationMatch = line.match(/#EXTINF:(-?\d+(?:\.\d+)?)/);
      const duration = durationMatch ? parseFloat(durationMatch[1]) : -1;

      // Extract all key="value" attributes
      const attrs = {};
      const attrRegex = /(\w[\w-]*)="([^"]*?)"/g;
      let match;
      while ((match = attrRegex.exec(line)) !== null) {
        attrs[match[1]] = match[2];
      }

      // Channel name is after the last comma
      const lastComma = line.lastIndexOf(',');
      const name = lastComma !== -1 ? line.substring(lastComma + 1).trim() : '';

      current = {
        name: name || attrs['tvg-name'] || 'Sin nombre',
        duration,
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || name || '',
        tvgLogo: attrs['tvg-logo'] || '',
        groupTitle: attrs['group-title'] || '',
        country: attrs['tvg-country'] || '',
        language: attrs['tvg-language'] || '',
        tvgShift: attrs['tvg-shift'] || '0',
        sourceLabel,
        url: null,
      };

    } else if (line.startsWith('#EXTVLCOPT')) {
      // VLC options — capture audio/subtitle track preferences
      if (current) {
        if (line.includes('audio-track')) {
          current.audioTrack = line.split('=').pop();
        }
        if (line.includes('sub-track') || line.includes('spu-track')) {
          current.subTrack = line.split('=').pop();
        }
      }
    } else if (line.startsWith('#')) {
      // Skip other M3U directives
      continue;
    } else if (current) {
      // This is the stream URL
      current.url = line;

      // Generate deterministic ID from URL
      current.id = Buffer.from(current.url).toString('base64url').slice(0, 20);

      // Add derived metadata
      current.quality = detectQuality(current);
      current.lang = detectLanguage(current);
      current.category = normalizeCategory(current.groupTitle, '');

      // Protocol detection
      if (line.includes('.m3u8') || line.includes('hls') || line.includes('playlist')) {
        current.protocol = 'HLS';
      } else if (line.includes('.ts') || line.includes('mpeg') || line.includes('mpegts')) {
        current.protocol = 'MPEG-TS';
      } else if (line.includes('rtmp://')) {
        current.protocol = 'RTMP';
      } else {
        current.protocol = 'HLS'; // default
      }

      // Is 4K?
      current.is4K = current.quality === '4K';

      // Is Spanish?
      current.isSpanish = current.lang === 'es';

      channels.push({ ...current });
      current = null;
    }
  }

  return channels;
}

// ─────────────────────────────────────────────────────────────────
// FETCH + PARSE (handles gzip, plain text)
// ─────────────────────────────────────────────────────────────────
async function fetchAndParse(source, type) {
  const { url, label } = source;
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Streamix/1.0)',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    let content;
    const isGzip =
      url.endsWith('.gz') ||
      response.headers['content-encoding'] === 'gzip' ||
      (response.data[0] === 0x1f && response.data[1] === 0x8b);

    if (isGzip) {
      const decompressed = await gunzip(Buffer.from(response.data));
      content = decompressed.toString('utf-8');
    } else {
      content = Buffer.from(response.data).toString('utf-8');
    }

    const channels = parseM3U(content, label);

    // Assign type and filter adult content
    return channels
      .filter(ch => ch.category !== 'adult' && ch.url)
      .map(ch => ({ ...ch, type }));

  } catch (err) {
    console.error(`[M3U] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// FETCH ALL SOURCES
// ─────────────────────────────────────────────────────────────────
async function fetchAllSources() {
  console.log('[M3U] Starting fetch from all sources...');
  const results = { live: [], movies: [], series: [] };

  for (const [type, sources] of Object.entries(FREE_SOURCES)) {
    const promises = sources.map(source => fetchAndParse(source, type));
    const resolved = await Promise.allSettled(promises);

    for (const result of resolved) {
      if (result.status === 'fulfilled') {
        results[type].push(...result.value);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    results[type] = results[type].filter(item => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    console.log(`[M3U] ${type}: ${results[type].length} items`);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// GROUPING HELPERS — Netflix-style carousels
// ─────────────────────────────────────────────────────────────────
function buildCarousels(contentDB) {
  const { live, movies, series } = contentDB;

  const carousels = [
    // LIVE TV
    {
      id: 'live-featured',
      title: '📺 En Vivo Ahora',
      items: shuffle(live.filter(c => ['MX', 'ES', 'US'].includes(c.country))).slice(0, 24),
    },
    {
      id: 'live-mexico',
      title: '🇲🇽 Canales México',
      items: live.filter(c => c.country === 'MX' || c.sourceLabel === 'México' || c.category === 'México').slice(0, 24),
    },
    {
      id: 'live-news',
      title: '📰 Noticias del Mundo',
      items: live.filter(c => c.category === 'Noticias').slice(0, 24),
    },
    {
      id: 'live-sports',
      title: '⚽ Deportes en Vivo',
      items: live.filter(c => c.category === 'Deportes').slice(0, 24),
    },
    // MOVIES
    {
      id: 'movies-4k',
      title: '✨ Películas en 4K UHD',
      items: movies.filter(m => m.is4K).slice(0, 24),
    },
    {
      id: 'movies-spanish',
      title: '🎬 Películas en Español',
      items: movies.filter(m => m.isSpanish).slice(0, 24),
    },
    {
      id: 'movies-featured',
      title: '🍿 Películas Populares',
      items: shuffle(movies).slice(0, 24),
    },
    // SERIES
    {
      id: 'series-featured',
      title: '📺 Series y TV Shows',
      items: shuffle(series).slice(0, 24),
    },
    {
      id: 'series-animation',
      title: '🎭 Animación',
      items: series.filter(s => s.category === 'Animación').slice(0, 24),
    },
    {
      id: 'kids',
      title: '👨‍👩‍👧 Familia e Infantil',
      items: [
        ...live.filter(c => c.category === 'Infantil'),
        ...series.filter(s => s.category === 'Infantil'),
      ].slice(0, 24),
    },
  ];

  // Filter empty carousels
  return carousels.filter(c => c.items.length > 0);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFeatured(contentDB) {
  // Pick a random 4K movie or popular live channel as hero
  const candidates = [
    ...contentDB.movies.filter(m => m.is4K && m.tvgLogo),
    ...contentDB.live.filter(c => c.tvgLogo && ['MX', 'ES'].includes(c.country)),
  ];
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * Math.min(candidates.length, 20))];
}

module.exports = {
  parseM3U,
  fetchAllSources,
  buildCarousels,
  getFeatured,
  detectQuality,
  detectLanguage,
  FREE_SOURCES,
  FREE_EPG_SOURCES,
};
