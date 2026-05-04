/**
 * Streamix — Live TV Page
 * Channel list with EPG current/next program + category filter
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const QUALITY_ORDER = { '4K': 0, '1080p': 1, '720p': 2, 'HD': 3, 'SD': 4 };

function ChannelCard({ channel, onPlay, isPlaying }) {
  const [hovered, setHovered] = useState(false);
  const prog = channel.currentProgram;
  const next = channel.nextProgram;

  // Progress of current program
  const progress = prog && prog.start && prog.stop
    ? Math.min(100, Math.max(0, (Date.now() - new Date(prog.start)) / (new Date(prog.stop) - new Date(prog.start)) * 100))
    : 0;

  return (
    <div
      onClick={() => onPlay(channel)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 14, padding: '14px 16px',
        borderRadius: 10, cursor: 'pointer',
        background: isPlaying
          ? 'rgba(229,9,20,0.12)'
          : hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        border: isPlaying
          ? '1px solid rgba(229,9,20,0.3)'
          : '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {/* Channel logo */}
      <div style={{
        width: 52, height: 36, borderRadius: 6, overflow: 'hidden',
        background: '#1a1a2e', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {channel.tvgLogo ? (
          <img src={channel.tvgLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => e.target.style.display = 'none'} />
        ) : (
          <span style={{ fontSize: 18 }}>📺</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {channel.name}
          </span>
          {channel.quality === '4K' && <span className="badge badge-4k" style={{ fontSize: 9 }}>4K</span>}
          {channel.lang === 'es' && <span className="badge badge-es" style={{ fontSize: 9 }}>ESP</span>}
        </div>

        {prog ? (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ▶ {prog.title}
              {prog.stop && (
                <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>
                  hasta {new Date(prog.stop).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#e50914', borderRadius: 1 }} />
            </div>
            {next && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                Siguiente: {next.title}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Sin guía de programación</div>
        )}
      </div>

      {/* Play indicator */}
      {(hovered || isPlaying) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: isPlaying ? '#e50914' : 'rgba(229,9,20,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#fff',
          }}>
            {isPlaying ? '■' : '▶'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LivePage({ onPlay, playingId }) {
  const [channels,   setChannels]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [activecat,  setActiveCat]  = useState('Todos');
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [hasNext,    setHasNext]    = useState(false);
  const [sortBy,     setSortBy]     = useState('country'); // country | quality | name
  const [search,     setSearch]     = useState('');

  const loadChannels = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    setLoading(true);
    try {
      const params = { page: p, limit: 60 };
      if (activecat !== 'Todos') params.category = activecat;
      if (search) params.search = search;

      const data = await api.live(params);
      setChannels(prev => reset ? (data.items || []) : [...prev, ...(data.items || [])]);
      setHasNext(data.hasNext || false);
      if (!reset) setPage(p + 1);
      else setPage(2);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activecat, page, search]);

  useEffect(() => {
    api.categories().then(cats => {
      setCategories([{ name: 'Todos', count: 0 }, ...(cats || []).slice(0, 12)]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadChannels(true);
  }, [activecat, search]);

  // Sort channels client-side
  const sorted = [...channels].sort((a, b) => {
    if (sortBy === 'quality') return (QUALITY_ORDER[a.quality] ?? 5) - (QUALITY_ORDER[b.quality] ?? 5);
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    // Default: country MX first, then ES, then US
    const preferred = ['MX', 'ES', 'US'];
    const ai = preferred.indexOf(a.country);
    const bi = preferred.indexOf(b.country);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{ padding: '32px 48px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>📺 TV en Vivo</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
          {channels.length} canales disponibles · {channels.filter(c => c.quality === '4K').length} en 4K
        </p>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 48px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); }}
          placeholder="Buscar canal..."
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, width: 220, outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="country">🌎 País</option>
          <option value="quality">✨ Calidad</option>
          <option value="name">🔤 Nombre</option>
        </select>

        {/* 4K only toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
          <input type="checkbox" style={{ accentColor: '#e50914' }}
            onChange={e => setSearch(e.target.checked ? '4K' : '')} />
          Solo 4K
        </label>
      </div>

      {/* Category pills */}
      <div style={{ padding: '0 48px 20px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => setActiveCat(cat.name)}
            style={{
              background: activecat === cat.name ? '#e50914' : 'rgba(255,255,255,0.07)',
              border: activecat === cat.name ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '7px 16px', borderRadius: 20,
              fontSize: 12, fontWeight: activecat === cat.name ? 600 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {cat.name}{cat.count > 0 && <span style={{ marginLeft: 5, opacity: 0.6, fontSize: 11 }}>{cat.count}</span>}
          </button>
        ))}
      </div>

      {/* Channel grid */}
      <div style={{ padding: '0 48px' }}>
        {loading && channels.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ height: 80, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {sorted.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onPlay={onPlay}
                isPlaying={playingId === ch.id}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasNext && !loading && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={() => loadChannels(false)}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', padding: '12px 32px', borderRadius: 8,
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cargar más canales
            </button>
          </div>
        )}

        {loading && channels.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p>No se encontraron canales</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} select option{background:#1a1a2e}`}</style>
    </div>
  );
}
