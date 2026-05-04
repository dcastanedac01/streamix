import { useState, useEffect } from 'react';
import HeroBanner from '../components/HeroBanner';
import ContentRow from '../components/ContentRow';
import api from '../services/api';

export default function HomePage({ onPlay }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.home()
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div>
      <div style={{ height: '75vh', minHeight: 480, background: 'linear-gradient(135deg,#0f0f1a,#1a0a2e)', display: 'flex', alignItems: 'flex-end', padding: '0 48px 80px' }}>
        <div style={{ maxWidth: 600 }}>
          {[320, 480, 380].map((w, i) => <div key={i} style={{ width: w, height: i === 0 ? 40 : 14, background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: i === 0 ? 16 : 8 }} />)}
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            {[150, 130].map((w, i) => <div key={i} style={{ width: w, height: 50, background: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />)}
          </div>
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ margin: '0 0 32px', padding: '0 48px' }}>
          <div style={{ width: 200, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            {[1,2,3,4,5,6].map(j => <div key={j} style={{ width: 200, height: 112, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />)}
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <p style={{ color: 'rgba(255,255,255,0.6)' }}>Error al cargar: {error}</p>
      <button onClick={() => window.location.reload()} style={{ background: '#e50914', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>Reintentar</button>
    </div>
  );

  if (data?.loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 20 }}>
      <div style={{ width: 52, height: 52, border: '4px solid rgba(255,255,255,0.08)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Cargando fuentes de video...</p>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>Primera carga puede tomar ~30 segundos</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div>
      <HeroBanner featured={data?.featured} onPlay={onPlay} />

      {/* Stats bar */}
      {data?.stats && (
        <div style={{ display: 'flex', gap: 24, padding: '14px 48px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
          {[
            { label: 'Canales en Vivo', count: data.stats.live,   icon: '📺' },
            { label: 'Películas',       count: data.stats.movies, icon: '🎬' },
            { label: 'Series',          count: data.stats.series, icon: '🎭' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{s.icon}</span>
              <span style={{ fontWeight: 700, color: '#fff' }}>{(s.count || 0).toLocaleString()}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>iptv-org/iptv (MIT) · TMDB</span>
        </div>
      )}

      <div style={{ paddingTop: 16, paddingBottom: 60 }}>
        {(data?.rows || []).map(row => (
          <ContentRow key={row.id} row={row} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}
