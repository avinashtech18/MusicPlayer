/**
 * WAVVVE — Music Player
 * Fixed: null checks on all DOM elements so no crashes
 */
'use strict';

/* ===========================
   STATE
   =========================== */
const State = (() => {
  let _songs = [];
  let _queue = [];
  let _queueIdx = -1;
  let _currentIdx = -1;
  let _isPlaying = false;
  let _isShuffle = false;
  let _isRepeat = false;
  let _volume = 0.7;
  let _isMuted = false;
  let _playlists = JSON.parse(localStorage.getItem('wavvve_playlists') || '[]');
  let _likedSongs = new Set(JSON.parse(localStorage.getItem('wavvve_liked') || '[]'));
  let _searchHistory = JSON.parse(localStorage.getItem('wavvve_search_history') || '[]');
  let _activeView = 'home';
  let _openPlaylistId = null;
  let _eqPreset = localStorage.getItem('wavvve_eq') || 'normal';

  const savePlaylists = () => localStorage.setItem('wavvve_playlists', JSON.stringify(_playlists));
  const saveLiked = () => localStorage.setItem('wavvve_liked', JSON.stringify([..._likedSongs]));
  const saveHistory = () => localStorage.setItem('wavvve_search_history', JSON.stringify(_searchHistory));
  const saveEQ = () => localStorage.setItem('wavvve_eq', _eqPreset);

  return {
    get songs() { return _songs; },
    get queue() { return _queue; },
    get queueIdx() { return _queueIdx; },
    get currentIdx() { return _currentIdx; },
    get isPlaying() { return _isPlaying; },
    get isShuffle() { return _isShuffle; },
    get isRepeat() { return _isRepeat; },
    get volume() { return _volume; },
    get isMuted() { return _isMuted; },
    get playlists() { return _playlists; },
    get likedSongs() { return _likedSongs; },
    get searchHistory() { return _searchHistory; },
    get activeView() { return _activeView; },
    get openPlaylistId() { return _openPlaylistId; },
    get eqPreset() { return _eqPreset; },

    setSongs(s) { _songs = s; },
    setPlaying(v) { _isPlaying = v; },
    setShuffle(v) { _isShuffle = v; },
    setRepeat(v) { _isRepeat = v; },
    setVolume(v) { _volume = Math.min(1, Math.max(0, v)); },
    setMuted(v) { _isMuted = v; },
    setActiveView(v) { _activeView = v; },
    setOpenPlaylist(id) { _openPlaylistId = id; },
    setEQ(p) { _eqPreset = p; saveEQ(); },

    buildQueue(songIdx) {
      if (_isShuffle) {
        const indices = _songs.map((_, i) => i).filter(i => i !== songIdx);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        _queue = [songIdx, ...indices];
        _queueIdx = 0;
      } else {
        _queue = _songs.map((_, i) => i);
        _queueIdx = songIdx;
      }
      _currentIdx = songIdx;
    },

    advance(dir = 1) {
      _queueIdx = (_queueIdx + dir + _queue.length) % _queue.length;
      _currentIdx = _queue[_queueIdx];
      return _currentIdx;
    },

    currentSong() { return _currentIdx >= 0 ? _songs[_currentIdx] : null; },
    queuePosition() { return _queueIdx + 1; },

    upcomingQueue() {
      if (_queue.length === 0) return [];
      const next = [];
      for (let i = _queueIdx + 1; i < Math.min(_queueIdx + 21, _queue.length); i++) {
        next.push({ song: _songs[_queue[i]], origIdx: _queue[i] });
      }
      return next;
    },

    toggleLike(idx) {
      if (_likedSongs.has(idx)) _likedSongs.delete(idx);
      else _likedSongs.add(idx);
      saveLiked();
    },

    addSearchHistory(query) {
      query = query.trim();
      if (!query) return;
      _searchHistory = _searchHistory.filter(h => h.toLowerCase() !== query.toLowerCase());
      _searchHistory.unshift(query);
      if (_searchHistory.length > 10) _searchHistory = _searchHistory.slice(0, 10);
      saveHistory();
    },

    removeSearchHistory(query) { _searchHistory = _searchHistory.filter(h => h !== query); saveHistory(); },
    clearSearchHistory() { _searchHistory = []; saveHistory(); },

    createPlaylist(name) {
      const pl = { id: Date.now(), name, songs: [] };
      _playlists.push(pl);
      savePlaylists();
      return pl;
    },

    addToPlaylist(plId, songIdx) {
      const pl = _playlists.find(p => p.id === plId);
      if (pl && !pl.songs.includes(songIdx)) { pl.songs.push(songIdx); savePlaylists(); return true; }
      return false;
    },

    removePlaylist(plId) { _playlists = _playlists.filter(p => p.id !== plId); savePlaylists(); },
  };
})();

/* ===========================
   AUDIO ENGINE
   =========================== */
const AudioEngine = (() => {
  const audio = document.getElementById('audio-player');
  let _onEnd = null, _onTime = null, _onLoad = null;

  audio.addEventListener('ended', () => _onEnd?.());
  audio.addEventListener('timeupdate', () => _onTime?.(audio.currentTime, audio.duration));
  audio.addEventListener('loadedmetadata', () => _onLoad?.(audio.duration));
  audio.addEventListener('error', () => console.warn('Audio error:', audio.src));

  return {
    get element() { return audio; },
    load(url) { audio.src = url; audio.load(); },
    play() { return audio.play().catch(() => { }); },
    pause() { audio.pause(); },
    seek(pct) { if (audio.duration) audio.currentTime = pct * audio.duration; },
    setVolume(v) { audio.volume = v; },
    setMuted(v) { audio.muted = v; },
    get currentTime() { return audio.currentTime; },
    get duration() { return audio.duration || 0; },
    get paused() { return audio.paused; },
    onEnd(cb) { _onEnd = cb; },
    onTime(cb) { _onTime = cb; },
    onLoad(cb) { _onLoad = cb; },
  };
})();

/* ===========================
   VISUALIZER
   =========================== */
const Visualizer = (() => {
  const BAR_COUNT = 28;
  let _container = null, _bars = [], _rafId = null, _playing = false, _t = 0;

  function init() {
    _container = document.getElementById('viz-bars');
    if (!_container) return;
    _container.innerHTML = '';
    _bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = document.createElement('div');
      bar.className = 'viz-bar';
      _container.appendChild(bar);
      _bars.push(bar);
    }
  }

  function start() {
    if (!_container) init();
    if (!_container) return; // still null = element missing, skip
    _playing = true;
    _container.classList.add('playing');
    _animate();
  }

  function stop() {
    _playing = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _container?.classList.remove('playing');
    _bars.forEach(b => { b.style.height = '4px'; });
  }

  function _animate() {
    if (!_playing) return;
    _rafId = requestAnimationFrame(_animate);
    _t += 0.04;
    _bars.forEach((bar, i) => {
      const raw = (
        Math.sin(_t * 2.1 + i * 0.6) * 0.4 +
        Math.sin(_t * 3.7 + i * 1.1) * 0.3 +
        Math.sin(_t * 1.3 + i * 0.3) * 0.3 + 1
      ) / 2;
      bar.style.height = Math.max(4, raw * 52) + 'px';
    });
  }

  return { init, start, stop };
})();

/* ===========================
   EQUALIZER
   =========================== */
const EQ = (() => {
  const PRESETS = {
    normal: [0, 0, 0, 0, 0],
    bass: [6, 5, 0, 0, 0],
    treble: [0, 0, 0, 5, 6],
    vocal: [-2, 3, 5, 3, -2],
    electronic: [4, 3, 0, 3, 4],
    acoustic: [3, 2, 1, 2, 2],
    lofi: [2, 1, -2, -3, -4],
    cinema: [2, 0, -1, 0, 3],
  };

  let _ctx = null, _filters = [], _connected = false;

  function setup(audioEl) {
    if (_connected) return;
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      const freqs = [60, 250, 1000, 4000, 14000];
      const source = _ctx.createMediaElementSource(audioEl);
      let prev = source;
      freqs.forEach(freq => {
        const f = _ctx.createBiquadFilter();
        f.type = 'peaking'; f.frequency.value = freq; f.Q.value = 1; f.gain.value = 0;
        prev.connect(f); prev = f; _filters.push(f);
      });
      prev.connect(_ctx.destination);
      _connected = true;
      applyPreset(State.eqPreset);
    } catch (e) { console.warn('EQ init failed:', e); }
  }

  function applyPreset(name) {
    const gains = PRESETS[name] || PRESETS.normal;
    _filters.forEach((f, i) => { f.gain.value = gains[i] || 0; });
  }

  function resume() { if (_ctx?.state === 'suspended') _ctx.resume(); }

  return { setup, applyPreset, resume };
})();

/* ===========================
   SLEEP TIMER
   =========================== */
const SleepTimer = (() => {
  let _timerId = null, _endTime = null, _tickId = null;

  function set(minutes) {
    clear();
    _endTime = Date.now() + minutes * 60000;
    _timerId = setTimeout(() => {
      AudioEngine.pause(); State.setPlaying(false);
      UI.updatePlayButton(false); Visualizer.stop(); MiniBar.update();
      clear(); showToast('😴 Sleep timer ended — music stopped');
    }, minutes * 60000);

    _tickId = setInterval(() => {
      const rem = _endTime - Date.now();
      if (rem <= 0) { clearInterval(_tickId); return; }
      const m = Math.floor(rem / 60000).toString().padStart(2, '0');
      const s = Math.floor((rem % 60000) / 1000).toString().padStart(2, '0');
      const el = document.getElementById('timer-countdown');
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);

    const activeEl = document.getElementById('timer-active');
    if (activeEl) activeEl.style.display = 'flex';
    showToast(`⏱ Sleep timer set for ${minutes} min`);
  }

  function clear() {
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    if (_tickId) { clearInterval(_tickId); _tickId = null; }
    _endTime = null;
    const el = document.getElementById('timer-active');
    if (el) el.style.display = 'none';
  }

  return { set, clear };
})();

/* ===========================
   MINI BAR — safe null checks on every element
   =========================== */
const MiniBar = (() => {
  // Safe helper: set textContent only if element exists
  const setText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const setDisp = (el, val) => { if (el) el.style.display = val; };

  function update() {
    const song = State.currentSong();
    const playing = State.isPlaying;

    // ── Desktop now playing bar ──
    const npb = document.getElementById('now-playing-bar');
    if (npb) {
      npb.classList.toggle('visible', !!song);
      if (song) setText('npb-text', `♪  Now Playing: ${song.title}${song.artist && song.artist !== 'Unknown' ? '  •  ' + song.artist : ''}`);
    }

    // ── Sidebar mini player (optional — only if elements exist) ──
    setText('sp-title', song ? song.title : 'Nothing playing');
    setText('sp-artist', song ? (song.artist || '—') : '—');

    const spArt = document.getElementById('sp-art');
    if (spArt) spArt.classList.toggle('playing', !!song && playing);

    const spIp = document.querySelector('#sp-play .icon-play');
    const spPp = document.querySelector('#sp-play .icon-pause');
    setDisp(spIp, playing ? 'none' : 'block');
    setDisp(spPp, playing ? 'block' : 'none');

    const spShuffle = document.getElementById('sp-shuffle');
    const spRepeat = document.getElementById('sp-repeat');
    if (spShuffle) spShuffle.classList.toggle('active', State.isShuffle);
    if (spRepeat) spRepeat.classList.toggle('active', State.isRepeat);

    // ── Mobile mini bar (optional) ──
    const mob = document.getElementById('mobile-now-playing');
    if (mob) {
      mob.classList.toggle('visible', !!song);
      if (song) {
        setText('mnp-title', song.title);
        setText('mnp-artist', song.artist || '—');
        const ip = mob.querySelector('.icon-play');
        const pp = mob.querySelector('.icon-pause');
        setDisp(ip, playing ? 'none' : 'block');
        setDisp(pp, playing ? 'block' : 'none');
      }
    }
  }

  function updateProgress(current, duration) {
    const pct = duration ? (current / duration) * 100 : 0;

    // Sidebar progress
    const spFill = document.getElementById('sp-progress-fill');
    const spThumb = document.getElementById('sp-thumb');
    if (spFill) spFill.style.width = pct + '%';
    if (spThumb) spThumb.style.left = pct + '%';
    setText('sp-current', UI ? UI.fmtTime(current) : '0:00');
    setText('sp-duration', UI ? UI.fmtTime(duration) : '0:00');

    // Mobile progress
    const fill = document.getElementById('mnp-progress-fill');
    if (fill) fill.style.width = pct + '%';
  }

  return { update, updateProgress };
})();

/* ===========================
   TOAST
   =========================== */
function showToast(msg, duration = 2800) {
  let t = document.getElementById('wavvve-toast');
  if (!t) { t = document.createElement('div'); t.id = 'wavvve-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ===========================
   UI HELPERS
   =========================== */
const UI = (() => {
  const $ = (s, ctx = document) => ctx ? ctx.querySelector(s) : null;
  const $$ = (s, ctx = document) => [...(ctx ? ctx.querySelectorAll(s) : [])];

  const el = {
    sidebar: $('#sidebar'),
    sidebarOverlay: $('#sidebar-overlay'),
    sidebarClose: $('#sidebar-close'),
    mobileMenuBtn: $('#mobile-menu-btn'),
    navItems: $$('.nav-item'),
    playlistList: $('#playlist-list'),
    newPlaylistBtn: $('#new-playlist-btn'),
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    searchHistory: $('#search-history'),
    greetingTime: $('#greeting-time'),
    songCountLabel: $('#song-count-label'),
    views: $$('.view'),
    songListHome: $('#song-list-home'),
    songListLib: $('#song-list-library'),
    songListSearch: $('#song-list-search'),
    songListPlaylist: $('#song-list-playlist'),
    songListQueue: $('#song-list-queue'),
    searchResultInfo: $('#search-result-info'),
    playlistGrid: $('#playlist-grid'),
    playlistDetail: $('#playlist-detail'),
    playlistDetailTitle: $('#playlist-detail-title'),
    playlistDetailCount: $('#playlist-detail-count'),
    playlistBack: $('#playlist-back'),
    playerTitle: $('#player-title'),
    playerArtist: $('#player-artist'),
    playerArt: $('#player-art'),
    playerHeart: $('#player-heart'),
    playerPosition: $('#player-position'),
    btnPlay: $('#btn-play'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    btnShuffle: $('#btn-shuffle'),
    btnRepeat: $('#btn-repeat'),
    btnMute: $('#btn-mute'),
    iconPlay: $('.icon-play', $('#btn-play')),
    iconPause: $('.icon-pause', $('#btn-play')),
    iconVolUp: $('.icon-vol-up', $('#btn-mute')),
    iconVolMute: $('.icon-vol-mute', $('#btn-mute')),
    progressTrack: $('#progress-track'),
    progressFill: $('#progress-fill'),
    progressThumb: $('#progress-thumb'),
    timeCurrent: $('#time-current'),
    timeDuration: $('#time-duration'),
    volumeTrack: $('#volume-track'),
    volumeFill: $('#volume-fill'),
    volumeThumb: $('#volume-thumb'),
    modalBackdrop: $('#modal-backdrop'),
    modalNewPlaylist: $('#modal-new-playlist'),
    playlistNameInput: $('#playlist-name-input'),
    confirmNewPlaylist: $('#confirm-new-playlist'),
    modalAddToPlaylist: $('#modal-add-to-playlist'),
    modalPlaylistList: $('#modal-playlist-list'),
  };

  function fmtTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createSongItem(song, songIdx, displayNum) {
    const li = document.createElement('li');
    li.className = 'song-item'; li.dataset.idx = songIdx; li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <div class="song-num">
        <span class="num-text">${displayNum}</span>
        <svg class="play-indicator" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div class="song-name" title="${escHtml(song.title)}">${escHtml(song.title)}</div>
      <div class="song-artist" title="${escHtml(song.artist || '—')}">${escHtml(song.artist || '—')}</div>
      <div class="song-actions">
        <button class="song-action-btn" data-action="add-to-playlist" data-idx="${songIdx}" title="Add to playlist" tabindex="-1">
          <svg viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm-8 2H2v2h8v-2z"/></svg>
        </button>
      </div>`;
    return li;
  }

  function renderSongList(ulEl, songs, indexMap) {
    if (!ulEl) return;
    const frag = document.createDocumentFragment();
    if (!songs.length) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg><p>No songs found</p></div>`;
      frag.appendChild(li);
    } else {
      songs.forEach((song, i) => frag.appendChild(createSongItem(song, indexMap[i], i + 1)));
    }
    ulEl.innerHTML = ''; ulEl.appendChild(frag); highlightPlaying(ulEl);
  }

  function renderQueueList() {
    const upcoming = State.upcomingQueue();
    const sub = document.getElementById('queue-subtitle');
    if (sub) sub.textContent = upcoming.length ? `${upcoming.length} songs coming up` : 'Queue is empty';
    if (el.songListQueue) renderSongList(el.songListQueue, upcoming.map(u => u.song), upcoming.map(u => u.origIdx));
  }

  function highlightPlaying(ulEl) {
    if (!ulEl) return;
    const playing = State.currentIdx;
    ulEl.querySelectorAll('.song-item').forEach(li => {
      li.classList.toggle('playing', parseInt(li.dataset.idx, 10) === playing);
    });
  }

  function highlightAllLists() {
    [el.songListHome, el.songListLib, el.songListSearch, el.songListPlaylist, el.songListQueue]
      .forEach(ul => highlightPlaying(ul));
  }

  // ── NULL-SAFE update functions ──
  function updatePlayButton(playing) {
    if (el.iconPlay) el.iconPlay.style.display = playing ? 'none' : 'block';
    if (el.iconPause) el.iconPause.style.display = playing ? 'block' : 'none';
    if (el.playerArt) el.playerArt.classList.toggle('playing', playing);
  }

  function updateProgress(current, duration) {
    const pct = duration ? (current / duration) * 100 : 0;
    if (el.progressFill) el.progressFill.style.width = pct + '%';
    if (el.progressThumb) el.progressThumb.style.left = pct + '%';
    if (el.timeCurrent) el.timeCurrent.textContent = fmtTime(current);
    if (el.timeDuration) el.timeDuration.textContent = fmtTime(duration);
    MiniBar.updateProgress(current, duration);
  }

  function updateVolume(vol) {
    if (el.volumeFill) el.volumeFill.style.width = (vol * 100) + '%';
    if (el.volumeThumb) el.volumeThumb.style.left = (vol * 100) + '%';
    if (el.iconVolUp) el.iconVolUp.style.display = (vol > 0 && !State.isMuted) ? 'block' : 'none';
    if (el.iconVolMute) el.iconVolMute.style.display = (vol === 0 || State.isMuted) ? 'block' : 'none';
  }

  function updatePlayerMeta(song) {
    if (!song) return;
    if (el.playerTitle) el.playerTitle.textContent = song.title;
    if (el.playerArtist) el.playerArtist.textContent = song.artist || '—';
    if (el.playerHeart) el.playerHeart.classList.toggle('liked', State.likedSongs.has(State.currentIdx));
    updatePosition();
    MiniBar.update();
  }

  function updatePosition() {
    if (!el.playerPosition) return;
    const pos = State.queuePosition(), total = State.songs.length;
    if (State.currentIdx >= 0 && total > 0) {
      el.playerPosition.textContent = `${State.isShuffle ? '🔀 ' : ''}${pos} / ${total}`;
      el.playerPosition.style.display = 'block';
    } else {
      el.playerPosition.style.display = 'none';
    }
  }

  function renderSearchHistory() {
    if (!el.searchHistory) return;
    const history = State.searchHistory;
    if (!history.length) { el.searchHistory.innerHTML = ''; el.searchHistory.classList.remove('visible'); return; }
    el.searchHistory.innerHTML = `
      <div class="sh-header"><span>Recent Searches</span><button class="sh-clear-all" id="sh-clear-all">Clear all</button></div>
      <ul class="sh-list">${history.map(q => `
        <li class="sh-item">
          <button class="sh-query" data-query="${escHtml(q)}">
            <svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
            ${escHtml(q)}
          </button>
          <button class="sh-remove" data-query="${escHtml(q)}">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </li>`).join('')}
      </ul>`;
    el.searchHistory.classList.add('visible');
    document.getElementById('sh-clear-all')?.addEventListener('click', () => { State.clearSearchHistory(); renderSearchHistory(); });
    el.searchHistory.querySelectorAll('.sh-query').forEach(btn => {
      btn.addEventListener('click', () => { el.searchInput.value = btn.dataset.query; Search.run(btn.dataset.query); el.searchHistory.classList.remove('visible'); });
    });
    el.searchHistory.querySelectorAll('.sh-remove').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); State.removeSearchHistory(btn.dataset.query); renderSearchHistory(); });
    });
  }

  function showView(viewId) {
    el.views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewId));
    el.navItems.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    State.setActiveView(viewId);
    if (viewId === 'queue') renderQueueList();
  }

  function renderSidebarPlaylists() {
    if (!el.playlistList) return;
    el.playlistList.innerHTML = '';
    State.playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name; li.dataset.id = pl.id;
      if (State.openPlaylistId === pl.id) li.classList.add('active');
      el.playlistList.appendChild(li);
    });
  }

  function renderPlaylistGrid() {
    if (!el.playlistGrid) return;
    if (!State.playlists.length) {
      el.playlistGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg><p>No playlists yet. Create one!</p></div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    State.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card'; card.dataset.id = pl.id;
      card.innerHTML = `<div class="playlist-card-icon"><svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg></div><div class="playlist-card-name">${escHtml(pl.name)}</div><div class="playlist-card-count">${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}</div>`;
      frag.appendChild(card);
    });
    el.playlistGrid.innerHTML = ''; el.playlistGrid.appendChild(frag);
  }

  function openPlaylistDetail(plId) {
    const pl = State.playlists.find(p => p.id === plId);
    if (!pl) return;
    State.setOpenPlaylist(plId);
    if (el.playlistGrid) el.playlistGrid.style.display = 'none';
    if (el.playlistDetail) el.playlistDetail.style.display = 'block';
    if (el.playlistDetailTitle) el.playlistDetailTitle.textContent = pl.name;
    if (el.playlistDetailCount) el.playlistDetailCount.textContent = `${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}`;
    renderSongList(el.songListPlaylist, pl.songs.map(i => State.songs[i]), [...pl.songs]);
    renderSidebarPlaylists();
  }

  function closePlaylistDetail() {
    State.setOpenPlaylist(null);
    if (el.playlistGrid) el.playlistGrid.style.display = '';
    if (el.playlistDetail) el.playlistDetail.style.display = 'none';
    renderSidebarPlaylists();
  }

  function openModal(id) {
    if (el.modalBackdrop) el.modalBackdrop.classList.add('open');
    document.getElementById(id)?.classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    if (el.modalBackdrop && !el.modalBackdrop.querySelectorAll('.modal.open').length)
      el.modalBackdrop.classList.remove('open');
  }

  function closeSidebar() {
    el.sidebar?.classList.remove('open');
    el.sidebarOverlay?.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
  }

  function openSidebar() {
    el.sidebar?.classList.add('open');
    el.sidebarOverlay?.classList.add('visible');
    document.body.classList.add('sidebar-open');
  }

  return {
    el, fmtTime, greeting, escHtml,
    renderSongList, renderQueueList, highlightPlaying, highlightAllLists,
    updatePlayButton, updateProgress, updateVolume, updatePlayerMeta, updatePosition,
    renderSearchHistory, showView,
    renderSidebarPlaylists, renderPlaylistGrid,
    openPlaylistDetail, closePlaylistDetail,
    openModal, closeModal, openSidebar, closeSidebar,
  };
})();

/* ===========================
   PLAYER
   =========================== */
const Player = (() => {
  function playSong(songIdx) {
    const song = State.songs[songIdx];
    if (!song) return;
    State.buildQueue(songIdx);
    AudioEngine.load(song.url);
    AudioEngine.setVolume(State.isMuted ? 0 : State.volume);
    EQ.setup(AudioEngine.element);
    EQ.resume();
    AudioEngine.play().then(() => {
      State.setPlaying(true);
      UI.updatePlayButton(true);
      UI.updatePlayerMeta(song);
      UI.highlightAllLists();
      Visualizer.start();
      if (State.activeView === 'queue') UI.renderQueueList();
    });
  }

  function togglePlay() {
    if (!State.currentSong()) return;
    if (State.isPlaying) { AudioEngine.pause(); State.setPlaying(false); Visualizer.stop(); }
    else { EQ.resume(); AudioEngine.play(); State.setPlaying(true); Visualizer.start(); }
    UI.updatePlayButton(State.isPlaying);
    MiniBar.update();
  }

  function playNext() { playSong(State.advance(1)); }
  function playPrev() {
    if (AudioEngine.currentTime > 3) { AudioEngine.seek(0); return; }
    playSong(State.advance(-1));
  }

  function toggleShuffle() {
    State.setShuffle(!State.isShuffle);
    UI.el.btnShuffle?.classList.toggle('active', State.isShuffle);
    if (State.currentIdx >= 0) State.buildQueue(State.currentIdx);
    UI.updatePosition();
    if (State.activeView === 'queue') UI.renderQueueList();
  }

  function toggleRepeat() {
    State.setRepeat(!State.isRepeat);
    UI.el.btnRepeat?.classList.toggle('active', State.isRepeat);
  }

  AudioEngine.onEnd(() => {
    if (State.isRepeat) { AudioEngine.seek(0); AudioEngine.play(); }
    else playNext();
  });

  AudioEngine.onTime((cur, dur) => { UI.updateProgress(cur, dur); });
  AudioEngine.onLoad((dur) => { UI.updateProgress(0, dur); });

  return { playSong, togglePlay, playNext, playPrev, toggleShuffle, toggleRepeat };
})();

/* ===========================
   SEARCH
   =========================== */
const Search = (() => {
  let _dt = null, _ls = '';
  function run(query) {
    query = query.trim().toLowerCase();
    UI.el.searchClear?.classList.toggle('visible', query.length > 0);
    if (!query) { UI.showView(State.activeView === 'search' ? 'home' : State.activeView); UI.renderSearchHistory(); return; }
    UI.el.searchHistory?.classList.remove('visible');
    const results = State.songs.reduce((acc, song, i) => {
      if ((song.title + ' ' + (song.artist || '')).toLowerCase().includes(query)) acc.push({ song, idx: i });
      return acc;
    }, []);
    UI.showView('search');
    if (UI.el.searchResultInfo) UI.el.searchResultInfo.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;
    UI.renderSongList(UI.el.songListSearch, results.map(r => r.song), results.map(r => r.idx));
    if (query !== _ls && query.length >= 2) { clearTimeout(_dt); _dt = setTimeout(() => { State.addSearchHistory(query); _ls = query; }, 1000); }
  }
  function debounce(query) { clearTimeout(_dt); _dt = setTimeout(() => run(query), 160); }
  return { run, debounce };
})();

/* ===========================
   PLAYLISTS
   =========================== */
const Playlists = (() => {
  let _pending = null;
  function openNewPlaylistModal() {
    if (UI.el.playlistNameInput) UI.el.playlistNameInput.value = '';
    UI.openModal('modal-new-playlist');
    setTimeout(() => UI.el.playlistNameInput?.focus(), 80);
  }
  function confirmCreate() {
    const name = UI.el.playlistNameInput?.value.trim();
    if (!name) return;
    State.createPlaylist(name); UI.closeModal('modal-new-playlist'); UI.renderSidebarPlaylists(); UI.renderPlaylistGrid();
  }
  function openAddToPlaylist(songIdx) {
    _pending = songIdx;
    const ul = UI.el.modalPlaylistList;
    if (!ul) return;
    ul.innerHTML = '';
    if (!State.playlists.length) { ul.innerHTML = '<li style="color:var(--text-2);padding:10px 12px;">No playlists yet.</li>'; }
    else { State.playlists.forEach(pl => { const li = document.createElement('li'); li.textContent = pl.name; li.dataset.id = pl.id; ul.appendChild(li); }); }
    UI.openModal('modal-add-to-playlist');
  }
  function addSongToPlaylist(plId) {
    if (_pending === null) return;
    const added = State.addToPlaylist(plId, _pending);
    _pending = null; UI.closeModal('modal-add-to-playlist');
    if (added) { UI.renderSidebarPlaylists(); UI.renderPlaylistGrid(); if (State.openPlaylistId === plId) UI.openPlaylistDetail(plId); }
  }
  return { openNewPlaylistModal, confirmCreate, openAddToPlaylist, addSongToPlaylist };
})();

/* ===========================
   SLIDER
   =========================== */
function makeSlider(trackEl, onChange) {
  if (!trackEl) return;
  let dragging = false;
  const getVal = e => {
    const rect = trackEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };
  trackEl.addEventListener('mousedown', e => { dragging = true; onChange(getVal(e)); });
  trackEl.addEventListener('touchstart', e => { dragging = true; onChange(getVal(e)); }, { passive: true });
  document.addEventListener('mousemove', e => { if (dragging) onChange(getVal(e)); });
  document.addEventListener('touchmove', e => { if (dragging) onChange(getVal(e)); }, { passive: true });
  document.addEventListener('mouseup', () => { dragging = false; });
  document.addEventListener('touchend', () => { dragging = false; });
}

/* ===========================
   INIT
   =========================== */
async function init() {
  if (UI.el.greetingTime) UI.el.greetingTime.textContent = UI.greeting();

  try {
    const res = await fetch('./songs.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const songs = await res.json();
    if (!Array.isArray(songs) || !songs.length) throw new Error('Empty');
    State.setSongs(songs);
    if (UI.el.songCountLabel) UI.el.songCountLabel.textContent = `${songs.length} songs in your library`;
    console.log(`✅ Loaded ${songs.length} songs`);
  } catch (e) { console.error('❌ songs.json:', e.message); State.setSongs([]); }

  const allIdx = State.songs.map((_, i) => i);
  UI.renderSongList(UI.el.songListHome, State.songs, allIdx);
  UI.renderSongList(UI.el.songListLib, State.songs, allIdx);
  UI.renderSidebarPlaylists();
  UI.renderPlaylistGrid();
  AudioEngine.setVolume(State.volume);
  UI.updateVolume(State.volume);
  Visualizer.init();

  // Apply saved EQ label
  document.querySelectorAll('.eq-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.eq === State.eqPreset));
  const eqLabel = document.getElementById('eq-active-name');
  if (eqLabel) eqLabel.textContent = State.eqPreset.charAt(0).toUpperCase() + State.eqPreset.slice(1);

  // ── NAV ──
  UI.el.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (UI.el.searchInput) UI.el.searchInput.value = '';
      UI.el.searchClear?.classList.remove('visible');
      UI.el.searchHistory?.classList.remove('visible');
      UI.showView(view);
      if (view === 'playlists') {
        if (UI.el.playlistGrid) UI.el.playlistGrid.style.display = '';
        if (UI.el.playlistDetail) UI.el.playlistDetail.style.display = 'none';
        State.setOpenPlaylist(null); UI.renderPlaylistGrid(); UI.renderSidebarPlaylists();
      }
      UI.closeSidebar();
    });
  });

  // ── SONG CLICK ──
  function handleSongListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (btn) { e.stopPropagation(); if (btn.dataset.action === 'add-to-playlist') Playlists.openAddToPlaylist(parseInt(btn.dataset.idx, 10)); return; }
    const li = e.target.closest('.song-item');
    if (li) Player.playSong(parseInt(li.dataset.idx, 10));
  }
  [UI.el.songListHome, UI.el.songListLib, UI.el.songListSearch, UI.el.songListPlaylist, UI.el.songListQueue]
    .filter(Boolean)
    .forEach(ul => ul.addEventListener('click', handleSongListClick));

  // ── SEARCH ──
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // delete
            dp[i][j - 1],     // insert
            dp[i - 1][j - 1]  // replace
          );
        }
      }
      if (!text.includes(q[0])) return null;
    }
    return dp[a.length][b.length];
  }








  const results = State.songs
    .map((song, i) => {
      const text = (song.title + " " + (song.artist || "")).toLowerCase();
      const q = query.toLowerCase();

      const distance = levenshtein(q, text);

      return { song, idx: i, score: distance };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 20); // limit results

  // ── PLAYER CONTROLS ──
  UI.el.btnPlay?.addEventListener('click', Player.togglePlay);
  UI.el.btnNext?.addEventListener('click', Player.playNext);
  UI.el.btnPrev?.addEventListener('click', Player.playPrev);
  UI.el.btnShuffle?.addEventListener('click', Player.toggleShuffle);
  UI.el.btnRepeat?.addEventListener('click', Player.toggleRepeat);

  UI.el.playerHeart?.addEventListener('click', () => {
    if (State.currentIdx < 0) return;
    State.toggleLike(State.currentIdx);
    UI.el.playerHeart.classList.toggle('liked', State.likedSongs.has(State.currentIdx));
  });

  // ── SLIDERS ──
  makeSlider(UI.el.progressTrack, pct => { AudioEngine.seek(pct); UI.updateProgress(AudioEngine.currentTime, AudioEngine.duration); });
  makeSlider(UI.el.volumeTrack, pct => { State.setVolume(pct); State.setMuted(pct === 0); AudioEngine.setVolume(pct); AudioEngine.setMuted(pct === 0); UI.updateVolume(pct); });
  UI.el.btnMute?.addEventListener('click', () => { const m = !State.isMuted; State.setMuted(m); AudioEngine.setMuted(m); UI.updateVolume(m ? 0 : State.volume); });

  // ── PLAYLISTS ──
  UI.el.newPlaylistBtn?.addEventListener('click', Playlists.openNewPlaylistModal);
  UI.el.confirmNewPlaylist?.addEventListener('click', Playlists.confirmCreate);
  UI.el.playlistNameInput?.addEventListener('keydown', e => { if (e.key === 'Enter') Playlists.confirmCreate(); });
  UI.el.playlistGrid?.addEventListener('click', e => { const c = e.target.closest('.playlist-card'); if (c) UI.openPlaylistDetail(parseInt(c.dataset.id, 10)); });
  UI.el.playlistList?.addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) { UI.showView('playlists'); UI.openPlaylistDetail(parseInt(li.dataset.id, 10)); } });
  UI.el.playlistBack?.addEventListener('click', UI.closePlaylistDetail);
  UI.el.modalPlaylistList?.addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) Playlists.addSongToPlaylist(parseInt(li.dataset.id, 10)); });

  // ── MODAL CLOSE ──
  document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => btn.addEventListener('click', () => UI.closeModal(btn.dataset.modal)));
  UI.el.modalBackdrop?.addEventListener('click', e => { if (e.target === UI.el.modalBackdrop) document.querySelectorAll('.modal.open').forEach(m => UI.closeModal(m.id)); });

  // ── SIDEBAR ──
  UI.el.mobileMenuBtn?.addEventListener('click', UI.openSidebar);
  UI.el.sidebarClose?.addEventListener('click', UI.closeSidebar);
  UI.el.sidebarOverlay?.addEventListener('click', UI.closeSidebar);

  // ── SLEEP TIMER ──
  document.getElementById('btn-sleep-timer')?.addEventListener('click', () => UI.openModal('modal-sleep-timer'));
  document.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      SleepTimer.set(parseInt(btn.dataset.mins));
      UI.closeModal('modal-sleep-timer');
    });
  });
  document.getElementById('timer-custom-set')?.addEventListener('click', () => {
    const val = parseInt(document.getElementById('timer-custom-input')?.value);
    if (!val || val < 1 || val > 480) { showToast('⚠️ Enter a time between 1 and 480 minutes'); return; }
    document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
    SleepTimer.set(val);
    UI.closeModal('modal-sleep-timer');
  });
  document.getElementById('timer-custom-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('timer-custom-set')?.click();
  });
  document.getElementById('btn-cancel-timer')?.addEventListener('click', () => { SleepTimer.clear(); showToast('⏱ Sleep timer cancelled'); });

  // ── EQ ──
  document.getElementById('btn-eq')?.addEventListener('click', () => UI.openModal('modal-eq'));
  document.querySelectorAll('.eq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.eq;
      State.setEQ(preset); EQ.applyPreset(preset);
      document.querySelectorAll('.eq-btn').forEach(b => b.classList.toggle('active', b.dataset.eq === preset));
      const label = document.getElementById('eq-active-name');
      if (label) label.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
      showToast(`🎛 EQ: ${preset}`);
    });
  });

  // ── MOBILE MINI BAR (optional elements) ──
  document.getElementById('mnp-play')?.addEventListener('click', Player.togglePlay);
  document.getElementById('mnp-next')?.addEventListener('click', Player.playNext);
  document.getElementById('mnp-prev')?.addEventListener('click', Player.playPrev);

  // ── SIDEBAR MINI PLAYER (optional elements) ──
  document.getElementById('sp-play')?.addEventListener('click', Player.togglePlay);
  document.getElementById('sp-next')?.addEventListener('click', Player.playNext);
  document.getElementById('sp-prev')?.addEventListener('click', Player.playPrev);
  document.getElementById('sp-shuffle')?.addEventListener('click', Player.toggleShuffle);
  document.getElementById('sp-repeat')?.addEventListener('click', Player.toggleRepeat);
  makeSlider(document.getElementById('sp-progress'), pct => {
    AudioEngine.seek(pct);
    UI.updateProgress(AudioEngine.currentTime, AudioEngine.duration);
  });

  // ── KEYBOARD ──
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); Player.togglePlay(); }
    if (e.code === 'ArrowRight') Player.playNext();
    if (e.code === 'ArrowLeft') Player.playPrev();
    if (e.code === 'KeyS') Player.toggleShuffle();
    if (e.code === 'KeyR') Player.toggleRepeat();
    if (e.code === 'KeyM') { const m = !State.isMuted; State.setMuted(m); AudioEngine.setMuted(m); UI.updateVolume(m ? 0 : State.volume); }
  });
}

document.addEventListener('DOMContentLoaded', init);