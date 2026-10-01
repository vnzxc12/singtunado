/**
 * Singtunado Karaoke — Mobile Remote Controller
 * Search songs, reserve into live queue, trigger soundboard crowd effects,
 * and control the TV stage wirelessly.
 */

(function () {
  let socket = null;
  let currentRoomCode = null;
  let currentSingerName = localStorage.getItem('singtunado_singer_name') || '';
  let curatedCategories = [];
  let currentCategory = 'all';
  let isPlaying = false;
  let searchDebounceTimer = null;

  // DOM Elements
  const roomTag = document.getElementById('room-tag');
  const singerNameDisplay = document.getElementById('singer-name-display');
  const editNameBtn = document.getElementById('edit-name-btn');
  const miniPlayerBar = document.getElementById('mini-player-bar');
  const miniPlayerText = document.getElementById('mini-player-text');
  const miniQueueCount = document.getElementById('mini-queue-count');
  const queueBadgeCount = document.getElementById('queue-badge-count');

  // Search & Songbook
  const songSearchInput = document.getElementById('song-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const songResultsContainer = document.getElementById('song-results-container');
  const filterChips = document.querySelectorAll('.filter-chip');
  const reservingAsName = document.getElementById('reserving-as-name');
  const changeSingerNameBtn = document.getElementById('change-singer-name-btn');
  let pendingReservation = null;

  // Queue View
  const queueNowPlaying = document.getElementById('queue-now-playing');
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingSinger = document.getElementById('now-playing-singer');
  const nowPlayingDuration = document.getElementById('now-playing-duration');
  const mobileQueueList = document.getElementById('mobile-queue-list');
  const queueTotalNum = document.getElementById('queue-total-num');

  // Nav
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Soundboard
  const soundBtns = document.querySelectorAll('.sound-btn');

  // Host Controls
  const remotePauseBtn = document.getElementById('remote-pause-btn');
  const remoteSkipBtn = document.getElementById('remote-skip-btn');
  const remoteReplayBtn = document.getElementById('remote-replay-btn');
  const changeRoomBtn = document.getElementById('change-room-btn');
  const mobileShowDonateBtn = document.getElementById('mobile-show-donate-btn');
  const closeMobileDonateBtn = document.getElementById('close-mobile-donate-btn');
  const mobileDonateModal = document.getElementById('mobile-donate-modal');

  // Modals
  const nameModal = document.getElementById('name-modal');
  const singerNameInput = document.getElementById('singer-name-input');
  const saveNameBtn = document.getElementById('save-name-btn');

  const roomModal = document.getElementById('room-modal');
  const roomCodeInput = document.getElementById('room-code-input');
  const joinRoomBtn = document.getElementById('join-room-btn');

  // 1. Initialize
  function init() {
    bindTabs();
    bindModals();
    bindSearch();
    bindSoundboard();
    bindControls();

    // Check singer name
    if (!currentSingerName) {
      showNameModal();
    } else {
      singerNameDisplay.textContent = currentSingerName;
      if (reservingAsName) reservingAsName.textContent = currentSingerName;
    }

    // Check Room Code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    if (roomParam) {
      currentRoomCode = roomParam.toUpperCase().trim();
      connectSocket(currentRoomCode);
    } else {
      showRoomModal();
    }

    // Load Curated songs for instant browsing
    loadCuratedSongs();
  }

  // 2. Socket.io Connection
  function connectSocket(roomCode) {
    socket = io();

    socket.on('connect', () => {
      console.log('[Remote] Connected to server, joining room:', roomCode);
      socket.emit('join_room', {
        roomCode,
        name: currentSingerName || 'Singer'
      }, (res) => {
        if (res && res.success) {
          currentRoomCode = res.roomCode;
          roomTag.textContent = `ROOM ${res.roomCode}`;
          hideRoomModal();
          updateRoomState(res.state);
        } else {
          alert(res ? res.error : 'Failed to join room');
          showRoomModal();
        }
      });
    });

    socket.on('room_state_updated', (state) => {
      updateRoomState(state);
    });

    socket.on('song_started', ({ song }) => {
      showToast(`🎶 Now Singing: ${song.song.title}`);
    });
  }

  // 3. Update Room State (Now Playing & Queue)
  function updateRoomState(state) {
    if (!state) return;

    const queue = state.queue || [];
    const current = state.currentSong;
    isPlaying = state.playback ? state.playback.isPlaying : false;

    // Mini Ticker Update
    if (current) {
      miniPlayerBar.classList.remove('idle');
      miniPlayerText.innerHTML = `<strong>${current.song.title}</strong> (${current.addedBy})`;
      nowPlayingTitle.textContent = current.song.title;
      nowPlayingSinger.textContent = `🎤 Singer: ${current.addedBy} • ${current.song.artist || 'Karaoke'}`;
      nowPlayingDuration.textContent = current.song.duration || '3:30';
      remotePauseBtn.textContent = isPlaying ? '⏸ Pause Song' : '▶ Resume Song';
    } else {
      miniPlayerBar.classList.add('idle');
      miniPlayerText.textContent = 'Stage is waiting for the next singer!';
      nowPlayingTitle.textContent = 'No song currently playing';
      nowPlayingSinger.textContent = 'Stage is ready for you!';
      nowPlayingDuration.textContent = '0:00';
      remotePauseBtn.textContent = '▶ Play Song';
    }

    miniQueueCount.textContent = `${queue.length} in queue`;
    queueTotalNum.textContent = queue.length;

    if (queue.length > 0) {
      queueBadgeCount.style.display = 'flex';
      queueBadgeCount.textContent = queue.length;
    } else {
      queueBadgeCount.style.display = 'none';
    }

    // Render Queue List
    renderQueueList(queue);
  }

  function renderQueueList(queue) {
    if (!queue || queue.length === 0) {
      mobileQueueList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin-top: 40px; font-size: 0.9rem;">
          <div style="font-size: 2.2rem; margin-bottom: 10px;">🎶</div>
          <p>No songs reserved yet.<br>Head to the <strong>Songbook</strong> tab to reserve your favorite tracks!</p>
        </div>`;
      return;
    }

    mobileQueueList.innerHTML = queue.map((item, index) => {
      const isMine = (item.addedBy === currentSingerName);
      return `
        <div class="queue-card">
          <div class="queue-badge">#${index + 1}</div>
          <img src="${item.song.thumbnail}" alt="" style="width: 54px; height: 40px; border-radius: var(--radius-sm); object-fit: cover;" onerror="this.src='https://i.ytimg.com/vi/${item.song.id}/hqdefault.jpg'">
          <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 0.9rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;">
              ${item.song.title}
            </div>
            <div class="queue-singer-tag">
              Reserved by: <strong>${item.addedBy}</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="btn btn-glass" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.singtunadoRemote.moveToTop('${item.queueId}')" title="Move to Next">
              ⚡ Top
            </button>
            ${isMine ? `
              <button class="queue-remove-btn" onclick="window.singtunadoRemote.removeSong('${item.queueId}')" title="Remove my song">
                ✕
              </button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Load Curated Songs Catalog
  async function loadCuratedSongs() {
    try {
      const res = await fetch('/api/curated');
      curatedCategories = await res.json();
      renderCuratedSongs();
    } catch (err) {
      console.error('Failed loading curated songs:', err);
    }
  }

  function renderCuratedSongs() {
    let allSongs = [];
    if (currentCategory === 'all') {
      curatedCategories.forEach(cat => {
        allSongs = allSongs.concat(cat.songs);
      });
    } else {
      const found = curatedCategories.find(c => c.category === currentCategory);
      if (found) allSongs = found.songs;
    }

    renderSongCards(allSongs);
  }

  // 5. Render Song Cards
  function renderSongCards(songs) {
    if (!songs || songs.length === 0) {
      songResultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <p>No songs found.<br>Try a different song or artist name!</p>
        </div>`;
      return;
    }

    songResultsContainer.innerHTML = songs.map(song => `
      <div class="song-card">
        <div class="song-thumb-box">
          <img class="song-thumb" src="${song.thumbnail}" alt="" onerror="this.src='https://i.ytimg.com/vi/${song.id}/hqdefault.jpg'">
          <span class="duration-tag">${song.duration}</span>
        </div>
        <div class="song-meta">
          <div class="song-title">${song.title}</div>
          <div class="song-artist">${song.artist || 'Karaoke Version'}</div>
        </div>
        <div class="song-actions">
          <button class="btn btn-primary btn-reserve" onclick="window.singtunadoRemote.reserveSong('${song.id}', '${encodeURIComponent(song.title)}', '${encodeURIComponent(song.artist || '')}', '${song.duration}', '${encodeURIComponent(song.thumbnail)}', false)">
            Reserve
          </button>
          <button class="btn btn-glass" style="padding: 4px 8px; font-size: 0.7rem;" onclick="window.singtunadoRemote.reserveSong('${song.id}', '${encodeURIComponent(song.title)}', '${encodeURIComponent(song.artist || '')}', '${song.duration}', '${encodeURIComponent(song.thumbnail)}', true)">
            ⚡ Play Next
          </button>
        </div>
      </div>
    `).join('');
  }

  // 6. YouTube Search Handler
  function bindSearch() {
    songSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearSearchBtn.style.display = query.length > 0 ? 'block' : 'none';

      clearTimeout(searchDebounceTimer);
      if (!query) {
        renderCuratedSongs();
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        songResultsContainer.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-muted);">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">⏳</div>
            <p>Searching YouTube Karaoke catalog...</p>
          </div>`;

        try {
          // Direct YouTube link detection
          let cleanQuery = query;
          const ytMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          if (ytMatch && ytMatch[1]) {
            cleanQuery = ytMatch[1];
          }

          const res = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`);
          const data = await res.json();
          renderSongCards(data.results || []);
        } catch (err) {
          songResultsContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #ef4444;">
              <p>Search failed. Check server connection.</p>
            </div>`;
        }
      }, 350);
    });

    clearSearchBtn.addEventListener('click', () => {
      songSearchInput.value = '';
      clearSearchBtn.style.display = 'none';
      renderCuratedSongs();
    });

    // Filter Chips
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentCategory = chip.getAttribute('data-category');
        songSearchInput.value = '';
        clearSearchBtn.style.display = 'none';
        renderCuratedSongs();
      });
    });
  }

  // 7. Song Reservation Action
  window.singtunadoRemote = {
    reserveSong: (id, encTitle, encArtist, duration, encThumb, addToTop) => {
      if (!socket) {
        alert('Not connected to a room');
        return;
      }

      // Enforce singer name input before reserving!
      if (!currentSingerName || currentSingerName.trim() === '' || currentSingerName === 'Guest') {
        pendingReservation = { id, encTitle, encArtist, duration, encThumb, addToTop };
        showNameModal();
        return;
      }

      const song = {
        id,
        title: decodeURIComponent(encTitle),
        artist: decodeURIComponent(encArtist),
        duration,
        thumbnail: decodeURIComponent(encThumb)
      };

      // Haptic feedback on phone
      if ('vibrate' in navigator) navigator.vibrate(40);

      socket.emit('queue_add', {
        song,
        addedBy: currentSingerName,
        addToTop
      }, (res) => {
        if (res && res.success) {
          showToast(addToTop ? `⚡ "${song.title}" added to TOP by ${currentSingerName}!` : `✅ "${song.title}" reserved by ${currentSingerName} (Position #${res.position})!`);
        } else {
          alert(res ? res.error : 'Failed to add song');
        }
      });
    },

    removeSong: (queueId) => {
      if (!socket) return;
      if (confirm('Remove this song from the queue?')) {
        socket.emit('queue_remove', { queueId });
      }
    },

    moveToTop: (queueId) => {
      if (!socket) return;
      socket.emit('queue_move_top', { queueId });
      showToast('⚡ Song moved to next in line!');
    }
  };

  // 8. Crowd Soundboard Reactions
  function bindSoundboard() {
    soundBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const soundType = btn.getAttribute('data-sound');

        // Tactile phone vibration
        if ('vibrate' in navigator) {
          navigator.vibrate([40, 30, 40]);
        }

        // Local sound feedback (if unlocked)
        if (window.soundboard) {
          window.soundboard.play(soundType);
        }

        // Broadcast to TV Stage via WebSocket
        if (socket) {
          socket.emit('sound_reaction', {
            type: soundType,
            sender: currentSingerName || 'Audience'
          });
        }

        showToast(`Blasted ${soundType.toUpperCase()} on TV! 💥`);
      });
    });
  }

  // 9. Navigation Tabs
  function bindTabs() {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');
        navItems.forEach(n => n.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  // 10. Modals & Name Management
  function bindModals() {
    // Edit Name
    editNameBtn.addEventListener('click', () => {
      showNameModal();
    });

    if (changeSingerNameBtn) {
      changeSingerNameBtn.addEventListener('click', () => {
        showNameModal();
      });
    }

    saveNameBtn.addEventListener('click', () => {
      const val = singerNameInput.value.trim();
      if (!val) {
        alert('Please enter your singer name!');
        return;
      }
      currentSingerName = val;
      localStorage.setItem('singtunado_singer_name', val);
      singerNameDisplay.textContent = val;
      if (reservingAsName) reservingAsName.textContent = val;
      hideNameModal();

      if (socket) {
        socket.emit('update_name', { name: val });
      }

      // If a song was waiting to be reserved, complete it now!
      if (pendingReservation) {
        const p = pendingReservation;
        pendingReservation = null;
        window.singtunadoRemote.reserveSong(p.id, p.encTitle, p.encArtist, p.duration, p.encThumb, p.addToTop);
      }
    });

    singerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveNameBtn.click();
    });

    // Join Room
    joinRoomBtn.addEventListener('click', () => {
      const val = roomCodeInput.value.trim().toUpperCase();
      if (!val || val.length !== 4) {
        alert('Please enter a valid 4-character Room Code!');
        return;
      }
      currentRoomCode = val;
      connectSocket(val);
    });

    roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinRoomBtn.click();
    });
  }

  function showNameModal() {
    singerNameInput.value = currentSingerName;
    nameModal.classList.remove('hidden');
    setTimeout(() => singerNameInput.focus(), 100);
  }

  function hideNameModal() {
    nameModal.classList.add('hidden');
  }

  function showRoomModal() {
    roomModal.classList.remove('hidden');
    setTimeout(() => roomCodeInput.focus(), 100);
  }

  function hideRoomModal() {
    roomModal.classList.add('hidden');
  }

  // 11. Remote Controls
  function bindControls() {
    remotePauseBtn.addEventListener('click', () => {
      if (!socket) return;
      socket.emit('playback_action', { action: isPlaying ? 'pause' : 'play' });
    });

    remoteSkipBtn.addEventListener('click', () => {
      if (!socket) return;
      if (confirm('Skip to next song on TV?')) {
        socket.emit('play_next');
      }
    });

    remoteReplayBtn.addEventListener('click', () => {
      if (!socket) return;
      socket.emit('replay_current');
    });

    changeRoomBtn.addEventListener('click', () => {
      if (confirm('Switch to a different karaoke room?')) {
        window.location.href = '/remote.html';
      }
    });

    if (mobileShowDonateBtn) {
      mobileShowDonateBtn.addEventListener('click', () => {
        mobileDonateModal.classList.remove('hidden');
      });
    }

    if (closeMobileDonateBtn) {
      closeMobileDonateBtn.addEventListener('click', () => {
        mobileDonateModal.classList.add('hidden');
      });
    }

    if (mobileDonateModal) {
      mobileDonateModal.addEventListener('click', (e) => {
        if (e.target === mobileDonateModal) {
          mobileDonateModal.classList.add('hidden');
        }
      });
    }
  }

  // Helper: Mini Toast
  function showToast(msg) {
    const existing = document.querySelector('.sing-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sing-toast';
    toast.style.cssText = `
      position: fixed;
      top: 75px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 15, 24, 0.95);
      border: 1px solid var(--accent-amber);
      color: #fff;
      padding: 10px 18px;
      border-radius: var(--radius-full);
      font-size: 0.85rem;
      font-weight: 700;
      z-index: 999;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      pointer-events: none;
      animation: fadeInOut 2.5s forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2600);
  }

  // Kickoff
  init();
})();
