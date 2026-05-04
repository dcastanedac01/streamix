/**
 * Streamix — ContentRow
 * Netflix-style horizontal scrolling carousel with hover preview
 */

import { useRef, useState } from 'react';

const CARD_W = 200;
const CARD_H = 112; // 16:9

function QualityBadge({ quality }) {
  if (quality === '4K') return <span className="badge badge-4k">4K</span>;
  if (quality === '1080p') return <span className="badge badge-hd">HD</span>;
  return null;
}

function LiveBadge() {
  return (
    <span className="badge badge-live" style={{ gap: 4 }}>
      <span className="quality-dot live" />
      EN VIVO
    </span>
  );
}

function ContentCard({ item, onClick, isLive }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const thumb = item.posterMd || item.backdropSm || item.tvgLogo;
  const bg = thumb && !imgError
    ? `url(${thumb}) center/cover no-repeat`
    : `linear-gradient(135deg, #1a1a2e, #16213e)`;

  return (
    <div
      onClick={() => onClick(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: `0 0 ${CARD_W}px`,
        height: CARD_H,
        borderRadius: 8,
        background: bg,
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        transform: hovered ? 'scale(1.06) translateY(-4px)' : 'scale(1)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, z-index 0s',
        zIndex: hovered ? 10 : 1,
        boxShadow: hovered
          ? '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Hidden img for error detection */}
      {thumb && (
        <img src={thumb} alt="" style={{ display: 'none' }}
          onError={() => setImgError(true)} />
      )}

      {/* Dark gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
      }} />

      {/* Badges top-right */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end',
      }}>
        {isLive ? <LiveBadge /> : <QualityBadge quality={item.quality} />}
        {item.lang === 'es' && <span className="badge badge-es">ESP</span>}
      </div>

      {/* Channel logo (live TV) */}
      {item.tvgLogo && isLive && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          width: 32, height: 32, borderRadius: 6,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src={item.tvgLogo} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => e.target.style.display = 'none'} />
        </div>
      )}

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>
          {item.name || item.title || 'Sin título'}
        </div>

        {/* EPG current program (live) */}
        {isLive && item.currentProgram && hovered && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.currentProgram.title}
          </div>
        )}

        {/* Year/rating (VOD) */}
        {!isLive && hovered && (
          <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
            {item.year && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{item.year}</span>}
            {item.rating && (
              <span style={{ fontSize: 10, color: '#f59e0b' }}>★ {item.rating}</span>
            )}
          </div>
        )}
      </div>

      {/* Play overlay on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(229,9,20,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(229,9,20,0.5)',
          }}>
            <span style={{ fontSize: 18, marginLeft: 3 }}>▶</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContentRow({ row, onPlay }) {
  const scrollRef = useRef(null);
  const [scrollPos, setScrollPos] = useState(0);

  const isLive = row.id?.includes('live');

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = (CARD_W + 12) * 3;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  const onScroll = () => {
    setScrollPos(scrollRef.current?.scrollLeft || 0);
  };

  if (!row.items?.length) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      {/* Row title */}
      <h2 style={{
        fontSize: 18, fontWeight: 600, marginBottom: 12,
        paddingLeft: 48, color: '#e5e5e5', letterSpacing: '-0.01em',
      }}>
        {row.title}
      </h2>

      {/* Scroll container */}
      <div style={{ position: 'relative' }}>
        {/* Left arrow */}
        {scrollPos > 0 && (
          <button onClick={() => scroll(-1)} style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 20,
            width: 48, background: 'linear-gradient(to right, rgba(10,10,15,1) 0%, rgba(10,10,15,0) 100%)',
            border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            paddingLeft: 8,
          }}>‹</button>
        )}

        {/* Right arrow */}
        <button onClick={() => scroll(1)} style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 20,
          width: 48, background: 'linear-gradient(to left, rgba(10,10,15,1) 0%, rgba(10,10,15,0) 100%)',
          border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: 8,
        }}>›</button>

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', overflowY: 'visible',
            padding: '8px 48px 16px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {row.items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              isLive={isLive}
              onClick={onPlay}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
