/**
 * Streamix — Movies & Series Pages
 * Grid layout with filter sidebar, quality/language filters
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const SORT_OPTIONS = [
  { value: 'default',    label: '⭐ Relevancia' },
  { value: 'rating',     label: '🏆 Mejor valorados' },
  { value: 'year-desc',  label: '📅 Más recientes' },
  { value: 'year-asc',   label: '📅 Más antiguos' },
  { value: 'name',       label: '🔤 A-Z' },
];

const QUALITY_FILTERS = ['Todos', '4K', '1080p', '720p', 'HD', 'SD'];
const LANG_FILTERS    = [
  { value: '',    label: 'Todos los idiomas' },
  { value: 'es',  label: '🇲🇽 Español' },
  { value: 'en',  label: '🇺🇸 Inglés' },
  { value: 'pt',  label: '🇧🇷 Portugués' },
];

function ContentGrid({ items, onPlay, type }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
      {items.map(item => (
        <MovieCard key={item.id} item={item} onPlay={onPlay} type={type} />
      ))}
    </div>
  );
}

function MovieCard({ item, onPlay, type }) {
  const [hovered, setHovered] = useState(false);
  const [imgErr,  setImgErr]  = useState(false);
  const thumb = item.posterMd || item.backdropSm || item.tvgLogo;

  return (
    <div
      onClick={() => onPlay(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Poster */}
      <div style={{ width: '100%', paddingTop: '150%', position: 'relative', background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
        {thumb && !imgErr && (
          <img
            src={thumb}
            alt={item.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgErr(true)}
          />
        )}
        {(!thumb || imgErr) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
            {type === 'series' ? '🎭' : '🎬'}
          </div>
        )}

        {/* Overlay on hover */}
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)',
          transition: 'background 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {hovered && (
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'rgba(229,9,20,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, boxShadow: '0 0 24px rgba(229,9,20,0.5)',
            }}>▶</div>
          )}
        </div>

        {/* Badges */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {item.quality === '4K' && <span className="badge badge-4k" style={{ fontSize: 10 }}>4K</span>}
          {item.lang === 'es' && <span className="badge badge-es" style={{ fontSize: 10 }}>ESP</span>}
        </div>

        {item.rating && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#f59e0b' }}>
            ★ {item.rating}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
          {item.name || item.title}
        </div>
        {item.year && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.year}</div>
        )}
      </div>
    </div>
  );
}

function ContentPage({ type, title, icon, fetcher, onPlay }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [quality, setQuality] = useState('Todos');
  const [lang,    setLang]    = useState('');
  const [sort,    setSort]    = useState('default');
  const [search,  setSearch]  = useState('');
  const [onlyES,  setOnlyES]  = useState(false);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 1 : page;
      const params = { page: p, limit: 48 };
      if (quality !== 'Todos') params.quality = quality;
      if (lang) params.lang = lang;
      if (search) params.search = search;
      if (onlyES) params.lang = 'es';

      const data = await fetcher(params);
      let newItems = data.items || [];

      // Client-side sort
      if (sort === 'rating')    newItems.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      if (sort === 'year-desc') newItems.sort((a, b) => (b.year || 0) - (a.year || 0));
      if (sort === 'year-asc')  newItems.sort((a, b) => (a.year || 0) - (b.year || 0));
      if (sort === 'name')      newItems.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));

      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setHasNext(data.hasNext || false);
      setPage(reset ? 2 : p + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [quality, lang, sort, search, onlyES, page, fetcher]);

  useEffect(() => { load(true); }, [quality, lang, sort, search, onlyES]);

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{ padding: '32px 48px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>{icon} {title}</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          {items.length} {type === 'series' ? 'series' : 'películas'} disponibles
          {items.filter(i => i.quality === '4K').length > 0 && ` · ${items.filter(i => i.quality === '4K').length} en 4K UHD`}
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '0 48px 24px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${type === 'series' ? 'series' : 'películas'}...`}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, width: 240, outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Quality filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {QUALITY_FILTERS.map(q => (
            <button key={q} onClick={() => setQuality(q)} style={{
              background: quality === q ? '#e50914' : 'rgba(255,255,255,0.06)',
              border: quality === q ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '6px 12px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: quality === q ? 700 : 400, transition: 'all 0.15s',
            }}>{q}</button>
          ))}
        </div>

        {/* Language */}
        <select value={lang} onChange={e => setLang(e.target.value)} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        }}>
          {LANG_FILTERS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>

        {/* Sort */}
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        }}>
          {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div style={{ padding: '0 48px' }}>
        {loading && items.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ paddingTop: '150%', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }} />
                <div style={{ height: 40 }} />
              </div>
            ))}
          </div>
        ) : (
          <ContentGrid items={items} onPlay={onPlay} type={type} />
        )}

        {/* Load more */}
        {hasNext && !loading && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button onClick={() => load(false)} style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', padding: '12px 36px', borderRadius: 8,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cargar más
            </button>
          </div>
        )}

        {loading && items.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
            <p>No se encontró contenido con estos filtros</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} select option{background:#1a1a2e;color:#fff}`}</style>
    </div>
  );
}

// Wrap ContentPage and inject onPlay via a ref trick
function withOnPlay(Component, props) {
  return function WrappedPage({ onPlay, ...rest }) {
    window.__streamixOnPlay = onPlay;
    return <Component onPlay={onPlay} {...rest} {...props} />;
  };
}

export function MoviesPage({ onPlay }) {
  return (
    <ContentPage
      type="movies"
      title="Películas"
      icon="🎬"
      fetcher={api.movies}
      onPlay={onPlay}
    />
  );
}

export function SeriesPage({ onPlay }) {
  return (
    <ContentPage
      type="series"
      title="Series"
      icon="🎭"
      fetcher={api.series}
      onPlay={onPlay}
    />
  );
}
