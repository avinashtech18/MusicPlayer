/**
 * WAVVVE — Music Player
 * Features: Song Position, True Shuffle, Search History
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

  const savePlaylists = () => localStorage.setItem('wavvve_playlists', JSON.stringify(_playlists));
  const saveLiked = () => localStorage.setItem('wavvve_liked', JSON.stringify([..._likedSongs]));
  const saveHistory = () => localStorage.setItem('wavvve_search_history', JSON.stringify(_searchHistory));

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

    setSongs(s) { _songs = s; },
    setPlaying(v) { _isPlaying = v; },
    setShuffle(v) { _isShuffle = v; },
    setRepeat(v) { _isRepeat = v; },
    setVolume(v) { _volume = Math.min(1, Math.max(0, v)); },
    setMuted(v) { _isMuted = v; },
    setActiveView(v) { _activeView = v; },
    setOpenPlaylist(id) { _openPlaylistId = id; },

    // ── TRUE SHUFFLE: Fisher-Yates, never repeats until all played ──
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

    currentSong() {
      return _currentIdx >= 0 ? _songs[_currentIdx] : null;
    },

    // Position in queue (1-based)
    queuePosition() {
      return _queueIdx + 1;
    },

    toggleLike(idx) {
      if (_likedSongs.has(idx)) _likedSongs.delete(idx);
      else _likedSongs.add(idx);
      saveLiked();
    },

    // ── SEARCH HISTORY ──
    addSearchHistory(query) {
      query = query.trim();
      if (!query) return;
      // Remove duplicate
      _searchHistory = _searchHistory.filter(h => h.toLowerCase() !== query.toLowerCase());
      // Add to front
      _searchHistory.unshift(query);
      // Keep only last 10
      if (_searchHistory.length > 10) _searchHistory = _searchHistory.slice(0, 10);
      saveHistory();
    },

    removeSearchHistory(query) {
      _searchHistory = _searchHistory.filter(h => h !== query);
      saveHistory();
    },

    clearSearchHistory() {
      _searchHistory = [];
      saveHistory();
    },

    createPlaylist(name) {
      const pl = { id: Date.now(), name, songs: [] };
      _playlists.push(pl);
      savePlaylists();
      return pl;
    },

    addToPlaylist(plId, songIdx) {
      const pl = _playlists.find(p => p.id === plId);
      if (pl && !pl.songs.includes(songIdx)) {
        pl.songs.push(songIdx);
        savePlaylists();
        return true;
      }
      return false;
    },

    removePlaylist(plId) {
      _playlists = _playlists.filter(p => p.id !== plId);
      savePlaylists();
    },
  };
})();

/* ===========================
   AUDIO ENGINE
   =========================== */
const AudioEngine = (() => {
  const audio = document.getElementById('audio-player');
  let _onEnd = null;
  let _onTime = null;
  let _onLoad = null;

  audio.addEventListener('ended', () => _onEnd?.());
  audio.addEventListener('timeupdate', () => _onTime?.(audio.currentTime, audio.duration));
  audio.addEventListener('loadedmetadata', () => _onLoad?.(audio.duration));
  audio.addEventListener('error', () => console.warn('Audio error for:', audio.src));

  return {
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
   UI HELPERS
   =========================== */
const UI = (() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createSongItem(song, songIdx, displayNum) {
    const li = document.createElement('li');
    li.className = 'song-item';
    li.dataset.idx = songIdx;
    li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <div class="song-num">
        <span class="num-text">${displayNum}</span>
        <svg class="play-indicator" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
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
    const frag = document.createDocumentFragment();
    if (!songs.length) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        <p>No songs found</p>
      </div>`;
      frag.appendChild(li);
    } else {
      songs.forEach((song, i) => {
        frag.appendChild(createSongItem(song, indexMap[i], i + 1));
      });
    }
    ulEl.innerHTML = '';
    ulEl.appendChild(frag);
    highlightPlaying(ulEl);
  }

  function highlightPlaying(ulEl) {
    const playing = State.currentIdx;
    ulEl.querySelectorAll('.song-item').forEach(li => {
      li.classList.toggle('playing', parseInt(li.dataset.idx, 10) === playing);
    });
  }

  function highlightAllLists() {
    [el.songListHome, el.songListLib, el.songListSearch, el.songListPlaylist]
      .forEach(ul => highlightPlaying(ul));
  }

  function updatePlayButton(playing) {
    el.iconPlay.style.display = playing ? 'none' : 'block';
    el.iconPause.style.display = playing ? 'block' : 'none';
    el.playerArt.classList.toggle('playing', playing);
  }

  function updateProgress(current, duration) {
    const pct = duration ? (current / duration) * 100 : 0;
    el.progressFill.style.width = pct + '%';
    el.progressThumb.style.left = pct + '%';
    el.timeCurrent.textContent = fmtTime(current);
    el.timeDuration.textContent = fmtTime(duration);
  }

  function updateVolume(vol) {
    el.volumeFill.style.width = (vol * 100) + '%';
    el.volumeThumb.style.left = (vol * 100) + '%';
    el.iconVolUp.style.display = (vol > 0 && !State.isMuted) ? 'block' : 'none';
    el.iconVolMute.style.display = (vol === 0 || State.isMuted) ? 'block' : 'none';
  }

  function updatePlayerMeta(song) {
    if (!song) return;
    el.playerTitle.textContent = song.title;
    el.playerArtist.textContent = song.artist || '—';
    el.playerArt.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    el.playerHeart.classList.toggle('liked', State.likedSongs.has(State.currentIdx));
    // ── UPDATE SONG POSITION ──
    updatePosition();
  }

  // ── SONG POSITION: "Playing 45 of 300" ──
  function updatePosition() {
    if (!el.playerPosition) return;
    const pos = State.queuePosition();
    const total = State.songs.length;
    if (State.currentIdx >= 0 && total > 0) {
      el.playerPosition.textContent = `${State.isShuffle ? '🔀 ' : ''}${pos} / ${total}`;
      el.playerPosition.style.display = 'block';
    } else {
      el.playerPosition.style.display = 'none';
    }
  }

  // ── SEARCH HISTORY UI ──
  function renderSearchHistory() {
    if (!el.searchHistory) return;
    const history = State.searchHistory;
    if (!history.length) {
      el.searchHistory.innerHTML = '';
      el.searchHistory.classList.remove('visible');
      return;
    }
    el.searchHistory.innerHTML = `
      <div class="sh-header">
        <span>Recent Searches</span>
        <button class="sh-clear-all" id="sh-clear-all">Clear all</button>
      </div>
      <ul class="sh-list">
        ${history.map(q => `
          <li class="sh-item">
            <button class="sh-query" data-query="${escHtml(q)}">
              <svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              ${escHtml(q)}
            </button>
            <button class="sh-remove" data-query="${escHtml(q)}" title="Remove">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </li>`).join('')}
      </ul>`;
    el.searchHistory.classList.add('visible');

    // Clear all button
    document.getElementById('sh-clear-all')?.addEventListener('click', () => {
      State.clearSearchHistory();
      renderSearchHistory();
    });

    // Click on history item
    el.searchHistory.querySelectorAll('.sh-query').forEach(btn => {
      btn.addEventListener('click', () => {
        el.searchInput.value = btn.dataset.query;
        Search.run(btn.dataset.query);
        el.searchHistory.classList.remove('visible');
      });
    });

    // Remove single item
    el.searchHistory.querySelectorAll('.sh-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        State.removeSearchHistory(btn.dataset.query);
        renderSearchHistory();
      });
    });
  }

  function showView(viewId) {
    el.views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewId));
    el.navItems.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    State.setActiveView(viewId);
  }

  function renderSidebarPlaylists() {
    el.playlistList.innerHTML = '';
    State.playlists.forEach(pl => {
      const li = document.createElement('li');
      li.textContent = pl.name;
      li.dataset.id = pl.id;
      if (State.openPlaylistId === pl.id) li.classList.add('active');
      el.playlistList.appendChild(li);
    });
  }

  function renderPlaylistGrid() {
    const frag = document.createDocumentFragment();
    if (!State.playlists.length) {
      el.playlistGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
        <p>No playlists yet. Create one!</p>
      </div>`;
      return;
    }
    State.playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.dataset.id = pl.id;
      card.innerHTML = `
        <div class="playlist-card-icon">
          <svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
        </div>
        <div class="playlist-card-name">${escHtml(pl.name)}</div>
        <div class="playlist-card-count">${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}</div>`;
      frag.appendChild(card);
    });
    el.playlistGrid.innerHTML = '';
    el.playlistGrid.appendChild(frag);
  }

  function openPlaylistDetail(plId) {
    const pl = State.playlists.find(p => p.id === plId);
    if (!pl) return;
    State.setOpenPlaylist(plId);
    el.playlistGrid.style.display = 'none';
    el.playlistDetail.style.display = 'block';
    el.playlistDetailTitle.textContent = pl.name;
    el.playlistDetailCount.textContent = `${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''}`;
    const songs = pl.songs.map(i => State.songs[i]);
    const indices = [...pl.songs];
    renderSongList(el.songListPlaylist, songs, indices);
    renderSidebarPlaylists();
  }

  function closePlaylistDetail() {
    State.setOpenPlaylist(null);
    el.playlistGrid.style.display = '';
    el.playlistDetail.style.display = 'none';
    renderSidebarPlaylists();
  }

  function openModal(id) {
    el.modalBackdrop.classList.add('open');
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    const open = el.modalBackdrop.querySelectorAll('.modal.open');
    if (!open.length) el.modalBackdrop.classList.remove('open');
  }

  function closeSidebar() {
    el.sidebar.classList.remove('open');
    el.sidebarOverlay.classList.remove('visible');
  }

  function openSidebar() {
    el.sidebar.classList.add('open');
    el.sidebarOverlay.classList.add('visible');
  }

  return {
    el, fmtTime, greeting, escHtml,
    renderSongList, highlightPlaying, highlightAllLists,
    updatePlayButton, updateProgress, updateVolume, updatePlayerMeta, updatePosition,
    renderSearchHistory,
    showView,
    renderSidebarPlaylists, renderPlaylistGrid,
    openPlaylistDetail, closePlaylistDetail,
    openModal, closeModal,
    openSidebar, closeSidebar,
  };
})();

/* ===========================
   PLAYBACK CONTROLLER
   =========================== */
const Player = (() => {
  function playSong(songIdx) {
    const song = State.songs[songIdx];
    if (!song) return;
    State.buildQueue(songIdx);
    AudioEngine.load(song.url);
    AudioEngine.setVolume(State.isMuted ? 0 : State.volume);
    AudioEngine.play().then(() => {
      State.setPlaying(true);
      UI.updatePlayButton(true);
      UI.updatePlayerMeta(song);
      UI.highlightAllLists();
    });
  }

  function togglePlay() {
    if (!State.currentSong()) return;
    if (State.isPlaying) {
      AudioEngine.pause();
      State.setPlaying(false);
    } else {
      AudioEngine.play();
      State.setPlaying(true);
    }
    UI.updatePlayButton(State.isPlaying);
  }

  function playNext() {
    const idx = State.advance(1);
    playSong(idx);
  }

  function playPrev() {
    if (AudioEngine.currentTime > 3) { AudioEngine.seek(0); return; }
    const idx = State.advance(-1);
    playSong(idx);
  }

  function toggleShuffle() {
    State.setShuffle(!State.isShuffle);
    UI.el.btnShuffle.classList.toggle('active', State.isShuffle);
    if (State.currentIdx >= 0) State.buildQueue(State.currentIdx);
    UI.updatePosition();
  }

  function toggleRepeat() {
    State.setRepeat(!State.isRepeat);
    UI.el.btnRepeat.classList.toggle('active', State.isRepeat);
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
  let _debounceTimer = null;
  let _lastSaved = '';

  function run(query) {
    query = query.trim().toLowerCase();
    UI.el.searchClear.classList.toggle('visible', query.length > 0);

    if (!query) {
      UI.showView(State.activeView === 'search' ? 'home' : State.activeView);
      UI.renderSearchHistory();
      return;
    }

    // Hide history while typing
    if (UI.el.searchHistory) UI.el.searchHistory.classList.remove('visible');

    const results = State.songs.reduce((acc, song, i) => {
      const haystack = (song.title + ' ' + (song.artist || '')).toLowerCase();
      if (haystack.includes(query)) acc.push({ song, idx: i });
      return acc;
    }, []);

    UI.showView('search');
    UI.el.searchResultInfo.textContent =
      `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;
    UI.renderSongList(
      UI.el.songListSearch,
      results.map(r => r.song),
      results.map(r => r.idx)
    );

    // Save to history after 1s pause (only if meaningful)
    if (query !== _lastSaved && query.length >= 2) {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        State.addSearchHistory(query);
        _lastSaved = query;
      }, 1000);
    }
  }

  function debounce(query) {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => run(query), 160);
  }

  return { run, debounce };
})();

/* ===========================
   PLAYLISTS CONTROLLER
   =========================== */
const Playlists = (() => {
  let _pendingSongIdx = null;

  function openNewPlaylistModal() {
    UI.el.playlistNameInput.value = '';
    UI.openModal('modal-new-playlist');
    setTimeout(() => UI.el.playlistNameInput.focus(), 80);
  }

  function confirmCreate() {
    const name = UI.el.playlistNameInput.value.trim();
    if (!name) return;
    State.createPlaylist(name);
    UI.closeModal('modal-new-playlist');
    UI.renderSidebarPlaylists();
    UI.renderPlaylistGrid();
  }

  function openAddToPlaylist(songIdx) {
    _pendingSongIdx = songIdx;
    const ul = UI.el.modalPlaylistList;
    ul.innerHTML = '';
    if (!State.playlists.length) {
      ul.innerHTML = '<li style="color:var(--text-2);padding:10px 12px;">No playlists yet. Create one first.</li>';
    } else {
      State.playlists.forEach(pl => {
        const li = document.createElement('li');
        li.textContent = pl.name;
        li.dataset.id = pl.id;
        ul.appendChild(li);
      });
    }
    UI.openModal('modal-add-to-playlist');
  }

  function addSongToPlaylist(plId) {
    if (_pendingSongIdx === null) return;
    const added = State.addToPlaylist(plId, _pendingSongIdx);
    _pendingSongIdx = null;
    UI.closeModal('modal-add-to-playlist');
    if (added) {
      UI.renderSidebarPlaylists();
      UI.renderPlaylistGrid();
      if (State.openPlaylistId === plId) UI.openPlaylistDetail(plId);
    }
  }

  return { openNewPlaylistModal, confirmCreate, openAddToPlaylist, addSongToPlaylist };
})();

/* ===========================
   SLIDER UTIL
   =========================== */
function makeSlider(trackEl, onChange) {
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
  UI.el.greetingTime.textContent = UI.greeting();

  // ── LOAD SONGS ──
  try {
    const res = await fetch('./songs.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const songs = await res.json();
    if (!Array.isArray(songs) || songs.length === 0) throw new Error('Empty songs list');
    State.setSongs(songs);
    if (UI.el.songCountLabel)
      UI.el.songCountLabel.textContent = `${songs.length} songs in your library`;
    console.log(`✅ Loaded ${songs.length} songs`);
  } catch (e) {
    console.error('❌ Could not load songs.json:', e.message);
    State.setSongs([]);
  }

  const allIdx = State.songs.map((_, i) => i);
  UI.renderSongList(UI.el.songListHome, State.songs, allIdx);
  UI.renderSongList(UI.el.songListLib, State.songs, allIdx);
  UI.renderSidebarPlaylists();
  UI.renderPlaylistGrid();

  AudioEngine.setVolume(State.volume);
  UI.updateVolume(State.volume);

  // ── NAV ──
  UI.el.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      UI.el.searchInput.value = '';
      UI.el.searchClear.classList.remove('visible');
      if (UI.el.searchHistory) UI.el.searchHistory.classList.remove('visible');
      UI.showView(view);
      if (view === 'playlists') {
        UI.el.playlistGrid.style.display = '';
        UI.el.playlistDetail.style.display = 'none';
        State.setOpenPlaylist(null);
        UI.renderPlaylistGrid();
        UI.renderSidebarPlaylists();
      }
      UI.closeSidebar();
    });
  });

  // ── SONG CLICK ──
  function handleSongListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      if (btn.dataset.action === 'add-to-playlist')
        Playlists.openAddToPlaylist(parseInt(btn.dataset.idx, 10));
      return;
    }
    const li = e.target.closest('.song-item');
    if (li) Player.playSong(parseInt(li.dataset.idx, 10));
  }

  [UI.el.songListHome, UI.el.songListLib, UI.el.songListSearch, UI.el.songListPlaylist]
    .forEach(ul => ul.addEventListener('click', handleSongListClick));

  // ── SEARCH with history ──
  UI.el.searchInput.addEventListener('focus', () => {
    if (!UI.el.searchInput.value.trim()) UI.renderSearchHistory();
  });

  UI.el.searchInput.addEventListener('input', e => {
    Search.debounce(e.target.value);
    if (!e.target.value.trim()) UI.renderSearchHistory();
  });

  UI.el.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      UI.el.searchInput.value = '';
      Search.run('');
      if (UI.el.searchHistory) UI.el.searchHistory.classList.remove('visible');
    }
    if (e.key === 'Enter' && UI.el.searchInput.value.trim()) {
      State.addSearchHistory(UI.el.searchInput.value.trim());
      if (UI.el.searchHistory) UI.el.searchHistory.classList.remove('visible');
    }
  });

  UI.el.searchClear.addEventListener('click', () => {
    UI.el.searchInput.value = '';
    Search.run('');
    UI.el.searchInput.focus();
    UI.renderSearchHistory();
  });

  // Hide history when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('#search-history')) {
      if (UI.el.searchHistory) UI.el.searchHistory.classList.remove('visible');
    }
  });

  // ── PLAYER CONTROLS ──
  UI.el.btnPlay.addEventListener('click', Player.togglePlay);
  UI.el.btnNext.addEventListener('click', Player.playNext);
  UI.el.btnPrev.addEventListener('click', Player.playPrev);
  UI.el.btnShuffle.addEventListener('click', Player.toggleShuffle);
  UI.el.btnRepeat.addEventListener('click', Player.toggleRepeat);

  UI.el.playerHeart.addEventListener('click', () => {
    if (State.currentIdx < 0) return;
    State.toggleLike(State.currentIdx);
    UI.el.playerHeart.classList.toggle('liked', State.likedSongs.has(State.currentIdx));
  });

  // ── SLIDERS ──
  makeSlider(UI.el.progressTrack, pct => {
    AudioEngine.seek(pct);
    UI.updateProgress(AudioEngine.currentTime, AudioEngine.duration);
  });

  makeSlider(UI.el.volumeTrack, pct => {
    State.setVolume(pct);
    State.setMuted(pct === 0);
    AudioEngine.setVolume(pct);
    AudioEngine.setMuted(pct === 0);
    UI.updateVolume(pct);
  });

  UI.el.btnMute.addEventListener('click', () => {
    const muted = !State.isMuted;
    State.setMuted(muted);
    AudioEngine.setMuted(muted);
    UI.updateVolume(muted ? 0 : State.volume);
  });

  // ── PLAYLISTS ──
  UI.el.newPlaylistBtn.addEventListener('click', Playlists.openNewPlaylistModal);
  UI.el.confirmNewPlaylist.addEventListener('click', Playlists.confirmCreate);
  UI.el.playlistNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') Playlists.confirmCreate();
  });

  UI.el.playlistGrid.addEventListener('click', e => {
    const card = e.target.closest('.playlist-card');
    if (card) UI.openPlaylistDetail(parseInt(card.dataset.id, 10));
  });

  UI.el.playlistList.addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) { UI.showView('playlists'); UI.openPlaylistDetail(parseInt(li.dataset.id, 10)); }
  });

  UI.el.playlistBack.addEventListener('click', UI.closePlaylistDetail);

  UI.el.modalPlaylistList.addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) Playlists.addSongToPlaylist(parseInt(li.dataset.id, 10));
  });

  // ── MODAL CLOSE ──
  document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.modal));
  });
  UI.el.modalBackdrop.addEventListener('click', e => {
    if (e.target === UI.el.modalBackdrop)
      document.querySelectorAll('.modal.open').forEach(m => UI.closeModal(m.id));
  });

  // ── MOBILE ──
  UI.el.mobileMenuBtn.addEventListener('click', UI.openSidebar);
  UI.el.sidebarClose.addEventListener('click', UI.closeSidebar);
  UI.el.sidebarOverlay.addEventListener('click', UI.closeSidebar);

  // ── KEYBOARD ──
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); Player.togglePlay(); }
    if (e.code === 'ArrowRight') Player.playNext();
    if (e.code === 'ArrowLeft') Player.playPrev();
    if (e.code === 'KeyS') Player.toggleShuffle();
    if (e.code === 'KeyR') Player.toggleRepeat();
    if (e.code === 'KeyM') {
      State.setMuted(!State.isMuted);
      AudioEngine.setMuted(State.isMuted);
      UI.updateVolume(State.isMuted ? 0 : State.volume);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);