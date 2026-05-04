/**
 * Streamix — TMDB Metadata Enrichment
 * Fetches movie/series metadata from The Movie Database API (free tier)
 * Register at: https://www.themoviedb.org/settings/api (completely free)
 *
 * Used to add: posters, backdrops, synopsis, genres, ratings, year
 */

const axios = require('axios');
const NodeCache = require('node-cache');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''; // Set in .env

// Image sizes available from TMDB
const IMG = {
  poster_sm:   `${TMDB_IMAGE_BASE}/w185`,
  poster_md:   `${TMDB_IMAGE_BASE}/w342`,
  poster_lg:   `${TMDB_IMAGE_BASE}/w500`,
  backdrop_sm: `${TMDB_IMAGE_BASE}/w780`,
  backdrop_lg: `${TMDB_IMAGE_BASE}/w1280`,
  original:    `${TMDB_IMAGE_BASE}/original`, // for 4K thumbnails
};

// Cache TMDB results for 24 hours
const tmdbCache = new NodeCache({ stdTTL: 86400 });

// ─────────────────────────────────────────────────────────────────
// SEARCH TMDB
// ─────────────────────────────────────────────────────────────────
async function searchTMDB(title, type = 'movie') {
  if (!TMDB_API_KEY) return null;

  const cacheKey = `tmdb:${type}:${title.toLowerCase().trim()}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
    const { data } = await axios.get(`${TMDB_BASE}/${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        query: title,
        language: 'es-MX', // Spanish metadata
        include_adult: false,
      },
      timeout: 10000,
    });

    const result = data.results?.[0] || null;
    const enriched = result ? enrichTMDBResult(result, type) : null;

    tmdbCache.set(cacheKey, enriched);
    return enriched;
  } catch (err) {
    console.warn(`[TMDB] Search failed for "${title}": ${err.message}`);
    tmdbCache.set(cacheKey, null);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// ENRICH TMDB RESULT
// ─────────────────────────────────────────────────────────────────
function enrichTMDBResult(result, type) {
  const title = result.title || result.name || '';
  const year  = (result.release_date || result.first_air_date || '').slice(0, 4);

  return {
    tmdbId:      result.id,
    title,
    originalTitle: result.original_title || result.original_name || title,
    year,
    synopsis:    result.overview || '',
    rating:      result.vote_average ? Math.round(result.vote_average * 10) / 10 : null,
    voteCount:   result.vote_count || 0,
    popularity:  result.popularity || 0,
    genres:      result.genre_ids || [],
    adult:       result.adult || false,
    language:    result.original_language || '',

    // Image URLs in multiple sizes
    posterSm:    result.poster_path    ? `${IMG.poster_sm}${result.poster_path}`    : null,
    posterMd:    result.poster_path    ? `${IMG.poster_md}${result.poster_path}`    : null,
    posterLg:    result.poster_path    ? `${IMG.poster_lg}${result.poster_path}`    : null,
    backdropSm:  result.backdrop_path  ? `${IMG.backdrop_sm}${result.backdrop_path}` : null,
    backdropLg:  result.backdrop_path  ? `${IMG.backdrop_lg}${result.backdrop_path}` : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// EXTRACT CLEAN TITLE FROM M3U NAME
// M3U names often contain quality/language tags: "Movie Name (2023) [4K] [ES]"
// ─────────────────────────────────────────────────────────────────
function cleanTitle(name) {
  return name
    .replace(/\(?\d{4}\)?/g, '')                     // Remove years
    .replace(/\[?(4K|UHD|HD|1080p?|720p?|SD|FHD)\]?/gi, '') // Quality tags
    .replace(/\[?(ES|EN|ESP|SPA|ENG|LAT|SUB|DUB)\]?/gi, '') // Language tags
    .replace(/\(?(S\d{1,2}E\d{1,2}|S\d{1,2})\)?/gi, '') // Episode markers
    .replace(/\s*[-|:]\s*$/g, '')                    // Trailing separators
    .replace(/\s{2,}/g, ' ')                         // Multiple spaces
    .trim();
}

// ─────────────────────────────────────────────────────────────────
// BATCH ENRICH — processes array of content items
// Respects TMDB rate limit: 40 requests/10s
// ─────────────────────────────────────────────────────────────────
async function batchEnrich(items, type, batchSize = 10) {
  if (!TMDB_API_KEY || !items.length) return items;

  const enriched = [...items];
  const toEnrich = items.map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item.posterMd); // Skip already enriched

  console.log(`[TMDB] Enriching ${toEnrich.length} ${type} items...`);

  for (let i = 0; i < toEnrich.length; i += batchSize) {
    const batch = toEnrich.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async ({ item, idx }) => {
        const title = cleanTitle(item.name || item.tvgName || '');
        if (!title || title.length < 2) return;

        const meta = await searchTMDB(title, type);
        if (meta) {
          enriched[idx] = { ...enriched[idx], ...meta };
        }
      })
    );

    // Rate limit: max 40 req/10s → wait 300ms between batches of 10
    if (i + batchSize < toEnrich.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return enriched;
}

// ─────────────────────────────────────────────────────────────────
// GENRE MAP (TMDB genre IDs → readable names in Spanish)
// ─────────────────────────────────────────────────────────────────
const GENRE_NAMES = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia',
  80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
  14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música',
  9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia Ficción',
  10770: 'Película de TV', 53: 'Thriller', 10752: 'Guerra', 37: 'Western',
  // TV genres
  10759: 'Acción', 10762: 'Kids', 10763: 'Noticias', 10764: 'Reality',
  10765: 'Sci-Fi', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

function resolveGenres(genreIds) {
  return (genreIds || []).map(id => GENRE_NAMES[id]).filter(Boolean);
}

module.exports = {
  searchTMDB,
  batchEnrich,
  cleanTitle,
  resolveGenres,
  IMG,
};
