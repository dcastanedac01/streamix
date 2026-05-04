/**
 * Streamix — HeroBanner
 * Full-bleed featured content banner with auto-rotation
 */

import { useState, useEffect } from 'react';

export default function HeroBanner({ featured, onPlay }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    setTimeout(() => setOpacity(1), 100);
  }, [featured]);

  if (!featured) {
    // Skeleton loader
    return (
      <div style={{
        height: '75vh', minHeight: 480,
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%)',
        display: 'flex', alignItems: 'flex-end',
        padding: '0 48px 80px',
      }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ width: 300, height: 36, background: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 16 }} />
          <div style={{ width: 500, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 400, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 140, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }} />
            <div style={{ width: 140, height: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
          </div>
        </div>
      </div>
    );
  }

  const bg = featured.backdropLg || featured.backdropSm || featured.tvgLogo;
  const title = featured.name || featured.title || '';
  const synopsis = featured.synopsis || featured.description || '';
  const isLive = featured.type === 'live';

  return (
    <div style={{
      position: 'relative', height: '75vh', minHeight: 480,
      overflow: 'hidden', opacity, transition: 'opacity 0.8s ease',
    }}>
      {/* Background image */}
      {bg ? (
        <div style={{
          position: 'absolute', inset: '-10%',
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          filter: 'blur(0px)',
          transform: 'scale(1.05)',
        }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1a0a2e 0%, #0f1a2e 50%, #0a150f 100%)',
        }} />
      )}

      {/* Gradients for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,10,15,0.95) 40%, rgba(10,10,15,0.4) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,1) 0%, rgba(10,10,15,0) 40%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,10,15,0.6) 0%, rgba(10,10,15,0) 20%)' }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 48px 80px',
        maxWidth: 700,
      }}>
        {/* Live badge */}
        {isLive && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <span className="badge badge-live" style={{ gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
              EN VIVO
            </span>
            {featured.country && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{featured.country}</span>}
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 56px)',
          fontWeight: 700, lineHeight: 1.1,
          marginBottom: 16,
          textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {featured.quality === '4K' && <span className="badge badge-4k">4K UHD</span>}
          {featured.rating && <span style={{ fontSize: 13, color: '#f59e0b' }}>★ {featured.rating}</span>}
          {featured.year && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{featured.year}</span>}
          {featured.lang === 'es' && <span className="badge badge-es">Español</span>}
          {featured.currentProgram && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {featured.currentProgram.title}
            </span>
          )}
        </div>

        {/* Synopsis */}
        {synopsis && (
          <p style={{
            fontSize: 15, lineHeight: 1.6,
            color: 'rgba(255,255,255,0.75)',
            marginBottom: 28,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            maxWidth: 580,
          }}>
            {synopsis}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => onPlay(featured)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', color: '#000',
              border: 'none', padding: '14px 28px',
              borderRadius: 8, fontSize: 17, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.85)'}
            onMouseLeave={e => e.target.style.background = '#fff'}
          >
            ▶ {isLive ? 'Ver en Vivo' : 'Reproducir'}
          </button>

          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(109,109,110,0.7)', color: '#fff',
              border: 'none', padding: '14px 24px',
              borderRadius: 8, fontSize: 17, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              backdropFilter: 'blur(4px)',
            }}
          >
            ℹ Más info
          </button>
        </div>
      </div>
    </div>
  );
}
