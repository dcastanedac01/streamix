/**
 * Streamix — API Service
 * Centralized API calls with local cache + retry logic
 */

const BASE = 'https://streamix-production-c957.up.railway.app';
const memCache = new Map();

async function apiFetch(path, opts = {}) {
  const url = `${BASE}${path}`;
  const cacheKey = url;
  const ttl = opts.ttl || 60000;

  const cached = memCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    memCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

export const api = {
  home:       ()            => apiFetch('/api/home', { ttl: 120000 }),
  live:       (params = {}) => apiFetch(`/api/live?${new URLSearchParams(params)}`, { ttl: 60000 }),
  movies:     (params = {}) => apiFetch(`/api/movies?${new URLSearchParams(params)}`, { ttl: 120000 }),
  series:     (params = {}) => apiFetch(`/api/series?${new URLSearchParams(params)}`, { ttl: 120000 }),
  content:    (id)          => apiFetch(`/api/content/${id}`, { ttl: 300000 }),
  epg:        (id)          => apiFetch(`/api/epg/${id}`, { ttl: 120000 }),
  search:     (q, type)     => apiFetch(`/api/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`, { ttl: 30000 }),
  streamUrl:  (id)          => `${BASE}/api/stream/${id}`,
  categories: ()            => apiFetch('/api/live/categories', { ttl: 3600000 }),
};

export default api;
