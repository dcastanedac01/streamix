/**
 * Streamix — App Root
 * Router + global state (active player, queue navigation)
 */

import { useState }                     from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar      from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import HomePage    from './pages/HomePage';
import LivePage    from './pages/LivePage';
import { MoviesPage, SeriesPage } from './pages/MoviesPage';
import './index.css';

// ── Watchlist placeholder ─────────────────────────────────────────
function WatchlistPage() {
  return (
    <div style={{ paddingTop: 120, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>❤️</div>
      <h2 style={{ fontSize: 22, color: '#fff', marginBottom: 8 }}>Mi Lista</h2>
      <p>Próximamente — agrega tus canales y películas favoritas</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentItem, setCurrentItem] = useState(null);
  const [queue,       setQueue]       = useState([]);
  const [queueIdx,    setQueueIdx]    = useState(0);

  const handlePlay = (item, playlist = []) => {
    setCurrentItem(item);
    if (playlist.length) {
      setQueue(playlist);
      setQueueIdx(playlist.findIndex(i => i.id === item.id));
    }
  };

  const handleNext = () => {
    if (!queue.length) return;
    const next = queue[queueIdx + 1];
    if (next) { setCurrentItem(next); setQueueIdx(i => i + 1); }
  };

  const handlePrev = () => {
    if (!queue.length) return;
    const prev = queue[queueIdx - 1];
    if (prev) { setCurrentItem(prev); setQueueIdx(i => i - 1); }
  };

  const handleClose = () => {
    setCurrentItem(null);
    setQueue([]);
    setQueueIdx(0);
  };

  return (
    <BrowserRouter>
      {/* Full-screen video player (renders on top of everything) */}
      {currentItem && (
        <VideoPlayer
          item={currentItem}
          onClose={handleClose}
          onNext={queue.length ? handleNext : undefined}
          onPrev={queue.length && queueIdx > 0 ? handlePrev : undefined}
        />
      )}

      {/* Navigation */}
      <Navbar onSearch={handlePlay} />

      {/* Pages */}
      <main>
        <Routes>
          <Route path="/"         element={<HomePage  onPlay={handlePlay} />} />
          <Route path="/live"     element={<LivePage   onPlay={handlePlay} playingId={currentItem?.id} />} />
          <Route path="/movies"   element={<MoviesPage onPlay={handlePlay} />} />
          <Route path="/series"   element={<SeriesPage onPlay={handlePlay} />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="*"         element={<HomePage  onPlay={handlePlay} />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
