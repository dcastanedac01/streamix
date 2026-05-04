/**
 * Streamix — VideoPlayer Component
 * Uses hls.js for HLS/M3U8 streams + native for MPEG-TS
 * Features: 4K, multi-audio, subtitle tracks, quality selector, live/VOD
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: '#000',
    display: 'flex', flexDirection: 'column',
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 20, zIndex: 9100,
    background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', width: 44, height: 44, borderRadius: '50%',
    fontSize: 22, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
    transition: 'background 0.2s',
  },
  video: {
    width: '100%', height: '100%', background: '#000',
    outline: 'none',
  },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: '40px 24px 24px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
    transition: 'opacity 0.3s',
  },
  title: {
    fontSize: 22, fontWeight: 700, marginBottom: 4,
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  },
  subtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16,
  },
  progressBar: {
    width: '100%', height: 4, background: 'rgba(255,255,255,0.2)',
    borderRadius: 2, cursor: 'pointer', position: 'relative', marginBottom: 12,
  },
  progress: {
    height: '100%', background: '#e50914', borderRadius: 2,
    transition: 'width 0.5s linear',
    position: 'relative',
  },
  progressDot: {
    position: 'absolute', right: -6, top: -4,
    width: 12, height: 12, borderRadius: '50%',
    background: '#e50914', border: '2px solid #fff',
    boxShadow: '0 0 8px rgba(229,9,20,0.8)',
  },
  btnRow: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  ctrlBtn: {
    background: 'none', border: 'none', color: '#fff',
    fontSize: 28, cursor: 'pointer', padding: '4px 8px',
    borderRadius: 6, transition: 'background 0.15s',
    display: 'flex', alignItems: 'center',
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  spacer: { flex: 1 },
  selectBtn: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', padding: '6px 12px', borderRadius: 6,
    fontSize: 12, cursor: 'pointer',
  },
  livePill: {
    background: '#e50914', color: '#fff', padding: '3px 10px',
    borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: '20px 24px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  logo: {
    width: 40, height: 40, borderRadius: 8,
    objectFit: 'cover', background: '#1a1a2e',
  },
  errorBox: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: '#0a0a0f',
  },
  loadBox: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#000',
  },
};

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer({ item, onClose, onNext, onPrev }) {
  const videoRef  = useRef(null);
  const hlsRef    = useRef(null);
  const timerRef  = useRef(null);

  const [playing,    setPlaying]    = useState(true);
  const [muted,      setMuted]      = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [progress,   setProgress]   = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [showCtrls,  setShowCtrls]  = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [qualities,  setQualities]  = useState([]);
  const [curQuality, setCurQuality] = useState(-1); // -1 = auto
  const [audioTracks, setAudioTracks] = useState([]);
  const [curAudio,   setCurAudio]   = useState(0);
  const [subtitles,  setSubtitles]  = useState([]);
  const [curSub,     setCurSub]     = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [retries,    setRetries]    = useState(0);

  const isLive = item?.type === 'live' || item?.duration === -1;

  // ── Hide controls after 3s of inactivity ──────────────────────
  const resetControlTimer = useCallback(() => {
    setShowCtrls(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (playing) setShowCtrls(false);
    }, 3000);
  }, [playing]);

  // ── Init HLS.js ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !item) return;

    setError(null);
    setLoading(true);
    setProgress(0);
    setDuration(0);
    setQualities([]);
    setAudioTracks([]);
    setSubtitles([]);

    const streamUrl = item.url;
    if (!streamUrl) { setError('URL de stream no disponible'); return; }

    const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('hls') ||
                  item.protocol === 'HLS' || !streamUrl.includes('.ts');

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker:       true,
        lowLatencyMode:     isLive,
        backBufferLength:   isLive ? 30 : 90,
        maxBufferLength:    isLive ? 10 : 30,
        maxMaxBufferLength: isLive ? 30 : 120,
        // Subtitles
        renderTextTracksNatively: false,
        // Retry config
        manifestLoadingMaxRetry:  5,
        levelLoadingMaxRetry:     5,
        fragLoadingMaxRetry:      6,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);

        // Quality levels
        const levels = data.levels.map((l, i) => ({
          id: i,
          label: l.height ? `${l.height}p${l.height >= 2160 ? ' 4K' : ''}` : `Level ${i}`,
          bitrate: l.bitrate,
          height: l.height,
        }));
        setQualities(levels);

        // Audio tracks
        const tracks = hls.audioTracks.map((t, i) => ({
          id: i, label: t.name || t.lang || `Track ${i}`, lang: t.lang,
        }));
        setAudioTracks(tracks);

        // Subtitle tracks
        const subs = hls.subtitleTracks.map((t, i) => ({
          id: i, label: t.name || t.lang || `Sub ${i}`, lang: t.lang,
        }));
        setSubtitles(subs);

        // Auto-select Spanish audio if available
        const esAudio = tracks.findIndex(t => t.lang?.toLowerCase().includes('es') || t.lang?.toLowerCase().includes('spa'));
        if (esAudio !== -1) { hls.audioTrack = esAudio; setCurAudio(esAudio); }

        // Auto-select Spanish subtitles
        const esSub = subs.findIndex(t => t.lang?.toLowerCase().includes('es') || t.lang?.toLowerCase().includes('spa'));
        if (esSub !== -1) { hls.subtitleTrack = esSub; setCurSub(esSub); }

        video.play().catch(() => { setMuted(true); video.muted = true; video.play(); });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (retries < 3) {
            console.warn('[HLS] Fatal error, retrying...', data);
            setRetries(r => r + 1);
            setTimeout(() => hls.startLoad(), 2000);
          } else {
            setError(`Error de stream: ${data.type}. Verifica que la URL sea accesible.`);
            setLoading(false);
          }
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = streamUrl;
      video.load();
      setLoading(false);
    } else {
      // Direct URL (MPEG-TS or other)
      video.src = streamUrl;
      video.load();
      setLoading(false);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [item]);

  // ── Video event listeners ─────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      // Buffered
      if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onPlay    = () => setPlaying(true);
    const onPause   = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnded   = () => { setPlaying(false); onNext?.(); };

    video.addEventListener('timeupdate',  onTimeUpdate);
    video.addEventListener('play',        onPlay);
    video.addEventListener('pause',       onPause);
    video.addEventListener('waiting',     onWaiting);
    video.addEventListener('playing',     onPlaying);
    video.addEventListener('ended',       onEnded);

    return () => {
      video.removeEventListener('timeupdate',  onTimeUpdate);
      video.removeEventListener('play',        onPlay);
      video.removeEventListener('pause',       onPause);
      video.removeEventListener('waiting',     onWaiting);
      video.removeEventListener('playing',     onPlaying);
      video.removeEventListener('ended',       onEnded);
    };
  }, [onNext]);

  // ── Keyboard controls ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch(e.code) {
        case 'Space':     e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': seek(10);  break;
        case 'ArrowLeft':  seek(-10); break;
        case 'ArrowUp':    adjustVolume(0.1); break;
        case 'ArrowDown':  adjustVolume(-0.1); break;
        case 'KeyF':       toggleFullscreen(); break;
        case 'KeyM':       toggleMute(); break;
        case 'Escape':     onClose?.(); break;
      }
      resetControlTimer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, volume]);

  // ── Controls ─────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play();
    setPlaying(!playing);
    resetControlTimer();
  };

  const seek = (secs) => {
    const v = videoRef.current;
    if (!v || isLive) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + secs));
    resetControlTimer();
  };

  const seekToPercent = (e) => {
    if (isLive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = pct * duration;
  };

  const adjustVolume = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = Math.max(0, Math.min(1, v.volume + delta));
    v.volume = vol;
    v.muted  = vol === 0;
    setVolume(vol);
    setMuted(vol === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const setQuality = (id) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = id;
    setCurQuality(id);
    resetControlTimer();
  };

  const setAudio = (id) => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = id;
    setCurAudio(id);
    resetControlTimer();
  };

  const setSub = (id) => {
    if (!hlsRef.current) return;
    hlsRef.current.subtitleTrack = id;
    setCurSub(id);
    resetControlTimer();
  };

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div style={styles.overlay} onMouseMove={resetControlTimer}>
      {/* Video */}
      <video
        ref={videoRef}
        style={styles.video}
        playsInline
        onClick={togglePlay}
        preload="auto"
      />

      {/* Loading spinner */}
      {loading && (
        <div style={styles.loadBox}>
          <div style={{
            width: 56, height: 56,
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#e50914',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={styles.errorBox}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <p style={{ color: '#fff', fontSize: 16, textAlign: 'center', maxWidth: 400 }}>{error}</p>
          <button
            onClick={() => { setError(null); setRetries(0); setLoading(true); }}
            style={{ background: '#e50914', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Controls — shown on hover */}
      <div style={{ ...styles.controls, opacity: showCtrls ? 1 : 0, pointerEvents: showCtrls ? 'all' : 'none' }}>
        {/* Title */}
        <div style={styles.title}>{item?.name || item?.title || 'Sin título'}</div>
        {item?.currentProgram && (
          <div style={styles.subtitle}>
            {item.currentProgram.title} — {item.currentProgram.description?.slice(0, 120)}
          </div>
        )}

        {/* Progress bar (VOD only) */}
        {!isLive && (
          <div style={styles.progressBar} onClick={seekToPercent}>
            {/* Buffered */}
            <div style={{ ...styles.progress, background: 'rgba(255,255,255,0.15)', width: `${bufPct}%`, position: 'absolute' }} />
            {/* Played */}
            <div style={{ ...styles.progress, width: `${pct}%` }}>
              <div style={styles.progressDot} />
            </div>
          </div>
        )}

        {/* Button row */}
        <div style={styles.btnRow}>
          {/* Prev */}
          {onPrev && (
            <button style={styles.ctrlBtn} onClick={onPrev} title="Anterior">⏮</button>
          )}

          {/* Play/Pause */}
          <button style={styles.ctrlBtn} onClick={togglePlay} title={playing ? 'Pausa' : 'Reproducir'}>
            {playing ? '⏸' : '▶️'}
          </button>

          {/* Next */}
          {onNext && (
            <button style={styles.ctrlBtn} onClick={onNext} title="Siguiente">⏭</button>
          )}

          {/* VOD: seek buttons */}
          {!isLive && (
            <>
              <button style={styles.ctrlBtn} onClick={() => seek(-10)} title="-10s">⏪</button>
              <button style={styles.ctrlBtn} onClick={() => seek(10)}  title="+10s">⏩</button>
            </>
          )}

          {/* Volume */}
          <button style={styles.ctrlBtn} onClick={toggleMute}>
            {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
            onChange={e => adjustVolume(parseFloat(e.target.value) - volume)}
            style={{ width: 80, accentColor: '#e50914' }}
          />

          {/* Time (VOD) or LIVE pill */}
          {isLive ? (
            <div style={styles.livePill}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              EN VIVO
            </div>
          ) : (
            <span style={styles.timeLabel}>
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          )}

          <div style={styles.spacer} />

          {/* Quality selector */}
          {qualities.length > 1 && (
            <select
              value={curQuality}
              onChange={e => setQuality(parseInt(e.target.value))}
              style={styles.selectBtn}
              title="Calidad"
            >
              <option value={-1}>Auto</option>
              {qualities.map(q => (
                <option key={q.id} value={q.id}>{q.label}</option>
              ))}
            </select>
          )}

          {/* Audio tracks */}
          {audioTracks.length > 1 && (
            <select
              value={curAudio}
              onChange={e => setAudio(parseInt(e.target.value))}
              style={styles.selectBtn}
              title="Audio"
            >
              {audioTracks.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          )}

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <select
              value={curSub}
              onChange={e => setSub(parseInt(e.target.value))}
              style={styles.selectBtn}
              title="Subtítulos"
            >
              <option value={-1}>Sin subtítulos</option>
              {subtitles.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          )}

          {/* Fullscreen */}
          <button style={styles.ctrlBtn} onClick={toggleFullscreen} title="Pantalla completa">
            {fullscreen ? '⛶' : '⛶'}
          </button>
        </div>
      </div>

      {/* Top bar — channel logo + close */}
      <div style={{ ...styles.topBar, opacity: showCtrls ? 1 : 0, transition: 'opacity 0.3s' }}>
        {item?.tvgLogo && (
          <img src={item.tvgLogo} alt="" style={styles.logo}
            onError={e => e.target.style.display = 'none'} />
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{item?.name || ''}</div>
          {item?.quality && (
            <span className={`badge badge-${item.quality === '4K' ? '4k' : 'hd'}`}>
              {item.quality}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select { background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
        input[type=range] { cursor: pointer; }
      `}</style>
    </div>
  );
}
