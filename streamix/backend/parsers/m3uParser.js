/**
 * Streamix — M3U Parser
 * Parses M3U/M3U8 playlist files from iptv-org (open source, free)
 * Handles: HLS (.m3u8), MPEG-TS, quality detection, language detection
 */
/**
 * Streamix — M3U Parser
 */

const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

const FREE_SOURCES = {
  live: [
    { url: 'https://iptv-org.github.io/iptv/countries/mx.m3u', label: 'México' },
    { url: 'https://iptv-org.github.io/iptv/countries/ar.m3u', label: 'Argentina' },
    { url: 'https://iptv-org.github.io/iptv/countries/co.m3u', label: 'Colombia' },
    { url: 'https://iptv-org.github.io/iptv/countries/cl.m3u', label: 'Chile' },
    { url: 'https://iptv-org.github.io/iptv/countries/ve.m3u', label: 'Venezuela' },
    { url: 'https://iptv-org.github.io/iptv/countries/pe.m3u', label: 'Perú' },
    { url: 'https://iptv-org.github.io/iptv/countries/es.m3u', label: 'España' },
    { url: 'https://iptv-org.github.io/iptv/countries/us.m3u', label: 'USA' },
    { url: 'https://iptv-org.github.io/iptv/languages/spa.m3u', label: 'Todo Español' },
    { url: 'https://iptv-org.github.io/iptv/categories/news.m3u', label: 'Noticias' },
    { url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', label: 'Deportes' },
    { url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u', label: 'Entretenimiento' },
    { url: 'https://iptv-org.github.io/iptv/categories/music.m3u', label: 'Música' },
    { url: 'https://iptv-org.github.io/iptv/categories/kids.m3u', label: 'Infantil' },
    { url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', label: 'Documentales' },
  ],
  movies: [
    { url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', label: 'Movies' },
  ],
  series: [
    { url: 'https://iptv-org.github.io/iptv/categories/series.m3u', label: 'Series' },
    { url: 'https://iptv-org.github.io/iptv/categories/animation.m3u', label: 'Animación' },
  ],
};

const FREE_EPG_SOURCES = [
  'https://iptv-org.github.io/epg/guides/mx/tvlistings.google.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/us/tvlistings.google.com.epg.xml.gz',
  'https://iptv-org.github.io/epg/guides/es/movistarplus.es.epg.xml.gz',
];

function detectQuality(channel) {
  const text = `${channel.name} ${channel.url} ${channel.tvgName}`.toLowerCase();
  if (text.includes('4k') || text.includes('uhd') || text.includes('2160')) return '4K';
  if (text.includes('1080') || text.includes('fhd') || text.includes('full hd')) return '1080p';
  if (text.includes('720') || text.includes(' hd') || text.includes('[hd]')) return '720p';
  if (text.includes('480') || text.includes('sd')) return 'SD';
  return 'HD';
}

function detectLanguage(channel) {
  if (channel.language) {
    const lang = channel.language.toLowerCase();
    if (lang.includes('spanish') || lang.includes('español') || lang === 'spa' || lang === 'es') return 'es';
    if (lang.includes('english') || lang === 'eng' || lang === 'en') return 'en';
    if (lang.includes('portuguese') || lang === 'por' || lang === 'pt') return 'pt';
    return lang.split(';')[0].trim().toLowerCase();
  }
  const name = (channel.name || '').toLowerCase();
  if (name.match(/mexico|méxico|mx|colombia|argentina|chile|perú|peru|venezuela/)) return 'es';
  if (name.match(/spain|españa|hispano|latina|español/)) return 'es';
  const spanishCountries = ['MX','ES','CO','AR','CL','VE','PE','EC','BO','PY','UY','GT','HN','SV','NI','CR','PA','DO','CU','PR'];
  if (channel.country && spanishCountries.includes(channel.country.toUpperCase())) return 'es';
  return 'unknown';
}

const CATEGORY_MAP = {
  'news': 'Noticias', 'noticias': 'Noticias',
  'sports': 'Deportes', 'deportes': 'Deportes', 'sport': 'Deportes',
  'movies': 'Películas', 'películas': 'Películas', 'peliculas': 'Películas', 'cine': 'Películas',
  'series': 'Series', 'animation': 'Animación', 'animated': 'Animación',
  'kids': 'Infantil', 'children': 'Infantil', 'family': 'Infantil',
  'entertainment': 'Entretenimiento', 'music': 'Música', 'música': 'Música',
  'documentary': 'Documentales', 'documentales': 'Documentales',
  'mexico': 'México', 'méxico': 'México',
  'xxx': 'adult', 'adult': 'adult', '+18': 'adult',
};

function normalizeCategory(groupTitle, type) {
  if (!groupTitle) return type === 'live' ? 'General' : (type === 'movies' ? 'Películas' : 'Series');
  const lower = groupTitle.toLowerCase().trim();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return groupTitle.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseM3U(content, sourceLabel = '') {
  const lines = content.split('\n');
  const channels = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const durationMatch = line.match(/#EXTINF:(-?\d+(?:\.\d+)?)/);
      const duration = durationMatch ? parseFloat(durationMatch[1]) : -1;
      const attrs = {};
      const attrRegex = /(\w[\w-]*)="([^"]*?)"/g;
      let match;
      while ((match = attrRegex.exec(line)) !== null) {
        attrs[match[1]] = match[2];
      }
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
        sourceLabel,
        url: null,
      };
    } else if (line.startsWith('#')) {
      continue;
    } else if (current) {
      current.url = line;
      current.id = Buffer.from(current.url).toString('base64url').slice(0, 20);
      current.quality = detectQuality(current);
      current.lang = detectLanguage(current);
      current.category = normalizeCategory(current.groupTitle, '');
      current.protocol = line.includes('.m3u8') || line.includes('hls') ? 'HLS' : 'HLS';
      current.is4K = current.quality === '4K';
      current.isSpanish = current.lang === 'es';
      channels.push({ ...current });
      current = null;
    }
  }
  return channels;
}

async function fetchAndParse(source, type) {
  const { url, label } = source;
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Streamix/1.0)', 'Accept-Encoding': 'gzip, deflate' },
    });
    let content;
    const buf = Buffer.from(response.data);
    const isGzip = url.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b);
    if (isGzip) {
      const decompressed = await gunzip(buf);
      content = decompressed.toString('utf-8');
    } else {
      content = buf.toString('utf-8');
    }
    const channels = parseM3U(content, label);
    return channels.filter(ch => ch.category !== 'adult' && ch.url).map(ch => ({ ...ch, type }));
  } catch (err) {
    console.error(`[M3U] Failed to fetch ${url}: ${err.message}`);
    return [];
  }
}

async function fetchAllSources() {
  console.log('[M3U] Starting fetch from all sources...');
  const results = { live: [], movies: [], series: [] };
  for (const [type, sources] of Object.entries(FREE_SOURCES)) {
    const promises = sources.map(source => fetchAndParse(source, type));
    const resolved = await Promise.allSettled(promises);
    for (const result of resolved) {
      if (result.status === 'fulfilled') results[type].push(...result.value);
    }
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCarousels(contentDB) {
  const { live, movies, series } = contentDB;
  const carousels = [
    { id: 'live-mexico',    title: '🇲🇽 Canales México',        items: live.filter(c => c.country === 'MX' || c.sourceLabel === 'México' || c.sourceLabel === 'Todo Español').slice(0, 24) },
    { id: 'live-news',      title: '📰 Noticias',               items: live.filter(c => c.category === 'Noticias').slice(0, 24) },
    { id: 'live-sports',    title: '⚽ Deportes en Vivo',        items: live.filter(c => c.category === 'Deportes').slice(0, 24) },
    { id: 'live-latam',     title: '🌎 Latinoamérica',          items: live.filter(c => ['AR','CO','CL','VE','PE'].includes(c.country)).slice(0, 24) },
    { id: 'live-entertain', title: '🎭 Entretenimiento',        items: live.filter(c => c.category === 'Entretenimiento').slice(0, 24) },
    { id: 'live-docs',      title: '🎥 Documentales',           items: live.filter(c => c.category === 'Documentales').slice(0, 24) },
    { id: 'live-kids',      title: '👶 Infantil',               items: live.filter(c => c.category === 'Infantil').slice(0, 24) },
    { id: 'movies-4k',      title: '✨ Películas en 4K UHD',    items: movies.filter(m => m.is4K).slice(0, 24) },
    { id: 'movies-spanish', title: '🎬 Películas en Español',   items: movies.filter(m => m.isSpanish).slice(0, 24) },
    { id: 'movies-popular', title: '🍿 Películas Populares',    items: shuffle(movies).slice(0, 24) },
    { id: 'series-all',     title: '📺 Series y TV Shows',      items: shuffle(series).slice(0, 24) },
    { id: 'series-anim',    title: '🎭 Animación',              items: series.filter(s => s.category === 'Animación').slice(0, 24) },
  ];
  return carousels.filter(c => c.items.length > 0);
}

function getFeatured(contentDB) {
  const candidates = [
    ...contentDB.live.filter(c => c.tvgLogo && c.country === 'MX'),
    ...contentDB.movies.filter(m => m.is4K && m.tvgLogo),
    ...contentDB.live.filter(c => c.tvgLogo && ['ES','AR','CO'].includes(c.country)),
  ];
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * Math.min(candidates.length, 20))];
}

module.exports = { parseM3U, fetchAllSources, buildCarousels, getFeatured, detectQuality, detectLanguage, FREE_SOURCES, FREE_EPG_SOURCES };
