/**
 * Streamix — Navbar
 * Netflix-style top navigation with search + scroll transparency
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const NAV_LINKS = [
  { path: '/',        label: 'Inicio' },
  { path: '/live',    label: '📺 En Vivo' },
  { path: '/movies',  label: '🎬 Películas' },
  { path: '/series',  label: '🎭 Series' },
];

export default function Navbar({ onSearch }) {
  const [scrolled,      setScrolled]      = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
    else { setSearchQuery(''); setSearchResults([]); }
  }, [searchOpen]);

  const handleSearchInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(debounce.current);
    if (!q.trim()) { setSearchResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.search(q);
        setSearchResults(data.results?.slice(0, 8) || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  };

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        height: 68,
        background: scrolled ? 'rgba(10,10,15,0.97)' : 'linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, transparent 100%)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.3s',
        display: 'flex', alignItems: 'center', padding: '0 48px', gap: 32,
      }}>
        {/* Logo */}
        <div onClick={() => navigate('/')} style={{
          fontSize: 24, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, #e50914, #ff6b6b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>STREAMIX</div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {NAV_LINKS.map(link => {
            const active = location.pathname === link.path;
            return (
              <button key={link.path} onClick={() => navigate(link.path)} style={{
                background: active ? 'rgba(229,9,20,0.12)' : 'none',
                border: active ? '1px solid rgba(229,9,20,0.25)' : '1px solid transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                padding: '6px 14px', borderRadius: 8, fontSize: 13,
                fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
                {link.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          {searchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={handleSearchInput}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                placeholder="Buscar canales, películas..."
                style={{
                  background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', padding: '8px 14px', borderRadius: 8,
                  fontSize: 14, width: 280, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={() => setSearchOpen(false)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                fontSize: 18, cursor: 'pointer', padding: 4,
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 16,
            }}>🔍</button>
          )}

          {/* Dropdown */}
          {searchOpen && (searchResults.length > 0 || searching) && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360,
              background: 'rgba(16,16,26,0.98)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, overflow: 'hidden', backdropFilter: 'blur(16px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}>
              {searching && <div style={{ padding: 16, color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>Buscando...</div>}
              {searchResults.map(item => (
                <div key={item.id} onClick={() => { onSearch?.(item); setSearchOpen(false); }} style={{
                  display: 'flex', gap: 12, padding: '10px 14px', cursor: 'pointer',
                  alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ width: 48, height: 30, borderRadius: 5, overflow: 'hidden', background: '#1a1a2e', flexShrink: 0 }}>
                    {(item.tvgLogo || item.posterSm) && (
                      <img src={item.tvgLogo || item.posterSm} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name || item.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {item.type === 'live' ? '📺 En Vivo' : item.type === 'movies' ? '🎬 Película' : '🎭 Serie'}{item.quality ? ` · ${item.quality}` : ''}
                    </div>
                  </div>
                  <span style={{ color: '#e50914', fontSize: 14 }}>▶</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4K badge */}
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: '4px 10px',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>4K</span> HDR
        </div>
      </nav>
      <div style={{ height: 68 }} />
    </>
  );
}
