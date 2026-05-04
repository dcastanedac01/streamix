#!/usr/bin/env node
/**
 * Streamix — Source Tester
 * Run before deploying to verify M3U sources and TMDB API are accessible
 * Usage: node scripts/test-sources.js
 */

const axios = require('axios');

const COLORS = {
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
};

const ok   = (msg) => console.log(`  ${COLORS.green}✓${COLORS.reset} ${msg}`);
const fail = (msg) => console.log(`  ${COLORS.red}✗${COLORS.reset} ${msg}`);
const info = (msg) => console.log(`  ${COLORS.blue}ℹ${COLORS.reset} ${msg}`);
const warn = (msg) => console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${msg}`);

// ─────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────
const M3U_SOURCES = [
  { name: 'All Channels (index)',     url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: 'México',                   url: 'https://iptv-org.github.io/iptv/countries/mx.m3u' },
  { name: 'España',                   url: 'https://iptv-org.github.io/iptv/countries/es.m3u' },
  { name: 'Movies',                   url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { name: 'Series',                   url: 'https://iptv-org.github.io/iptv/categories/series.m3u' },
  { name: 'Sports',                   url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'News',                     url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
];

const EPG_SOURCES = [
  { name: 'EPG México',   url: 'https://iptv-org.github.io/epg/guides/mx/tvlistings.google.com.epg.xml.gz' },
  { name: 'EPG USA',      url: 'https://iptv-org.github.io/epg/guides/us/tvlistings.google.com.epg.xml.gz' },
];

async function testUrl(name, url, timeout = 15000) {
  try {
    const start = Date.now();
    const resp = await axios.get(url, {
      timeout,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Streamix-Tester/1.0' },
    });
    const ms   = Date.now() - start;
    const size = (resp.data.byteLength / 1024).toFixed(1);
    ok(`${name} — ${resp.status} OK · ${size} KB · ${ms}ms`);
    return true;
  } catch (err) {
    fail(`${name} — ${err.code || err.message}`);
    return false;
  }
}

async function testTMDB(apiKey) {
  try {
    const resp = await axios.get('https://api.themoviedb.org/3/movie/popular', {
      params: { api_key: apiKey, language: 'es-MX', page: 1 },
      timeout: 10000,
    });
    const count = resp.data.results?.length || 0;
    ok(`TMDB API — OK · ${count} películas populares devueltas`);
    return true;
  } catch (err) {
    fail(`TMDB API — ${err.response?.data?.status_message || err.message}`);
    if (err.response?.status === 401) warn('Verifica que TMDB_API_KEY sea válida en tu archivo .env');
    return false;
  }
}

async function countM3UEntries(url) {
  try {
    const resp = await axios.get(url, {
      timeout: 20000,
      responseType: 'text',
      headers: { 'User-Agent': 'Streamix-Tester/1.0' },
    });
    const matches = (resp.data.match(/#EXTINF/g) || []).length;
    return matches;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${COLORS.bold}${COLORS.blue}╔════════════════════════════════════════╗`);
  console.log(`║    Streamix — Source Connectivity Test  ║`);
  console.log(`╚════════════════════════════════════════╝${COLORS.reset}\n`);

  // ── M3U Sources ──────────────────────────────────────────────
  console.log(`${COLORS.bold}📺 M3U Sources (iptv-org/iptv):${COLORS.reset}`);
  let m3uPassed = 0;
  for (const s of M3U_SOURCES) {
    const ok = await testUrl(s.name, s.url);
    if (ok) m3uPassed++;
  }

  // Count entries in index
  console.log('\n  Contando entradas en index.m3u...');
  const count = await countM3UEntries('https://iptv-org.github.io/iptv/index.m3u');
  info(`index.m3u contiene ~${count.toLocaleString()} streams`);

  // ── EPG Sources ───────────────────────────────────────────────
  console.log(`\n${COLORS.bold}📅 EPG Sources (iptv-org/epg):${COLORS.reset}`);
  let epgPassed = 0;
  for (const s of EPG_SOURCES) {
    const ok = await testUrl(s.name, s.url, 30000);
    if (ok) epgPassed++;
  }

  // ── TMDB API ──────────────────────────────────────────────────
  console.log(`\n${COLORS.bold}🎬 TMDB API:${COLORS.reset}`);
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    warn('TMDB_API_KEY no configurada en .env — los pósters no se cargarán');
    warn('Regístrate gratis en: https://www.themoviedb.org/settings/api');
  } else {
    await testTMDB(tmdbKey);
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(`\n${COLORS.bold}📊 Resumen:${COLORS.reset}`);
  console.log(`  M3U: ${m3uPassed}/${M3U_SOURCES.length} fuentes accesibles`);
  console.log(`  EPG: ${epgPassed}/${EPG_SOURCES.length} fuentes accesibles`);

  if (m3uPassed >= 4) {
    console.log(`\n  ${COLORS.green}${COLORS.bold}✅ Sistema listo para deploy${COLORS.reset}`);
    console.log(`  ${COLORS.green}Ejecuta: npm start${COLORS.reset}\n`);
  } else {
    console.log(`\n  ${COLORS.yellow}⚠ Algunas fuentes no están disponibles.${COLORS.reset}`);
    console.log(`  ${COLORS.yellow}El servidor puede seguir funcionando con las fuentes accesibles.${COLORS.reset}\n`);
  }
}

main().catch(err => {
  console.error('Error en test:', err.message);
  process.exit(1);
});
