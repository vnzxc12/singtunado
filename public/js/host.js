/**
 * Singtunado Karaoke — TV Host Stage Controller
 * Manages YouTube Iframe Player, real-time Socket.io queue sync,
 * countdown transitions, QR code display, and audience soundboard reactions.
 */

(function () {
  let socket = null;
  let ytPlayer = null;
  let isYtReady = false;
  let currentRoomCode = null;
  let currentSong = null;
  let queue = [];
  let isTransitioning = false;

  // DOM Elements
  const roomCodeDisplay = document.getElementById('room-code-display');
  const singersCountBadge = document.getElementById('singers-count-badge');
  const queueCountBadge = document.getElementById('queue-count-badge');
  const nowSingingBar = document.getElementById('now-singing-bar');
  const currentSongTitle = document.getElementById('current-song-title');
  const currentSongSinger = document.getElementById('current-song-singer');
  const currentSongArtist = document.getElementById('current-song-artist');
  const idleStage = document.getElementById('idle-stage');
  const nextUpTicker = document.getElementById('next-up-ticker');
  const qrWidget = document.getElementById('qr-widget');
  const qrImage = document.getElementById('qr-image');
  const qrUrlText = document.getElementById('qr-url-text');
  const stageQueueDrawer = document.getElementById('stage-queue-drawer');
  const queueItemsList = document.getElementById('queue-items-list');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const countdownSinger = document.getElementById('countdown-singer');
  const countdownSong = document.getElementById('countdown-song');
  const reactionsContainer = document.getElementById('reactions-container');

  // Stage Big QR Modal Elements
  const tvQrModal = document.getElementById('tv-qr-modal');
  const closeQrModalBtn = document.getElementById('close-qr-modal-btn');
  const modalRoomCode = document.getElementById('modal-room-code');
  const modalQrImage = document.getElementById('modal-qr-image');
  const modalQrUrlText = document.getElementById('modal-qr-url-text');
  const expandQrModalBtn = document.getElementById('expand-qr-modal-btn');
  let nowSingingDimTimer = null;

  // Buttons
  const toggleQrBtn = document.getElementById('toggle-qr-btn');
  const minimizeQrBtn = document.getElementById('minimize-qr-btn');
  const toggleQueueBtn = document.getElementById('toggle-queue-btn');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const skipSongBtn = document.getElementById('skip-song-btn');
  const replaySongBtn = document.getElementById('replay-song-btn');
  const startStarterBtn = document.getElementById('start-starter-btn');
  const expandQrBtn = document.getElementById('expand-qr-btn');
  const resModeBtn = document.getElementById('res-mode-btn');
  const toggleDonateBtn = document.getElementById('toggle-donate-btn');
  const idleDonateBtn = document.getElementById('idle-donate-btn');
  const closeDonateModalBtn = document.getElementById('close-donate-modal-btn');
  const tvDonateModal = document.getElementById('tv-donate-modal');

  // Initialize
  function init() {
    initSocket();
    initYouTubeAPI();
    bindEvents();
  }

  // 1. Socket.io Connection & Room Creation
  function initSocket() {
    socket = io();

    socket.on('connect', () => {
      console.log('[Host] Connected to server, creating room...');
      socket.emit('host_create_room', { hostUrl: window.location.origin }, (res) => {
        if (res && res.success) {
          currentRoomCode = res.roomCode;
          roomCodeDisplay.textContent = res.roomCode;
          qrImage.src = res.qrDataUrl;
          qrUrlText.textContent = res.remoteUrl;
          if (modalRoomCode) modalRoomCode.textContent = res.roomCode;
          if (modalQrImage) modalQrImage.src = res.qrDataUrl;
          if (modalQrUrlText) modalQrUrlText.textContent = res.remoteUrl;
          updateRoomState(res.state);
        }
      });
    });

    // Listen for room updates
    socket.on('room_state_updated', (state) => {
      updateRoomState(state);
    });

    // Listen for new song started
    socket.on('song_started', ({ song }) => {
      console.log('[Host] Song started:', song);
      startSongWithCountdown(song);
    });

    // Listen for queue ended
    socket.on('queue_ended', () => {
      console.log('[Host] Queue ended');
      currentSong = null;
      nowSingingBar.classList.add('hidden');
      nowSingingBar.classList.remove('dimmed');
      clearTimeout(nowSingingDimTimer);
      idleStage.classList.remove('hidden');
      nextUpTicker.textContent = 'Queue is empty. Scan QR to reserve songs!';
      if (ytPlayer && ytPlayer.stopVideo) {
        try { ytPlayer.stopVideo(); } catch (e) {}
      }
    });

    // Listen for new song queued notification
    socket.on('song_queued_notification', ({ title, singer, position }) => {
      showStageToast(`🎵 <strong>${singer}</strong> reserved "${title}" (In Queue #${position})`);
    });

    // Listen for new singer joined
    socket.on('user_joined_announcement', ({ name }) => {
      showStageToast(`👋 <strong>${name}</strong> connected to the stage!`);
    });

    // Listen for soundboard reactions from mobile singers
    socket.on('play_reaction', ({ type, sender }) => {
      handleIncomingReaction(type, sender);
    });

    // Listen for remote host commands (pause, play, skip, volume)
    socket.on('host_command', ({ action, value }) => {
      if (!ytPlayer) return;
      try {
        if (action === 'pause') ytPlayer.pauseVideo();
        if (action === 'play') ytPlayer.playVideo();
        if (action === 'replay') { ytPlayer.seekTo(0); ytPlayer.playVideo(); }
        if (action === 'volume') ytPlayer.setVolume(value);
      } catch (e) {
        console.warn('Host command error:', e);
      }
    });
  }

  // 2. YouTube Iframe API Loader
  function initYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = function () {
      console.log('[YouTube] IFrame API ready');
      ytPlayer = new YT.Player('yt-player', {
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          playsinline: 1
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    };
  }

  function onPlayerReady(event) {
    console.log('[YouTube] Player ready');
    isYtReady = true;
    event.target.setVolume(100);

    // If a song was queued before player was ready
    if (currentSong && !isTransitioning) {
      ytPlayer.loadVideoById(currentSong.song.id);
    }
  }

  // Score Reveal Modal DOM & Tiers
  const scoreRevealModal = document.getElementById('score-reveal-modal');
  const ksmScoreDisplay = document.getElementById('ksm-score-display');
  const ksmPhraseDisplay = document.getElementById('ksm-phrase-display');
  const ksmPhraseEmoji = document.getElementById('ksm-phrase-emoji');
  const ksmPhraseQuote = document.getElementById('ksm-phrase-quote');
  const ksmSingAgainBtn = document.getElementById('ksm-sing-again-btn');
  const ksmNextQueueBtn = document.getElementById('ksm-next-queue-btn');
  let scoreModalTimer = null;

  const EASTER_EGG_SCORES = {
    1: { emoji: '🥇', quote: 'Number one! Wait, no, out of 100. Yikes.' },
    69: { emoji: '😏', quote: 'Nice. 🎸' },
    99: { emoji: '😤', quote: 'One point away. The algorithm is just being petty.' },
    100: { emoji: '🛑', quote: "HACKER DETECTED. (Just kidding, you're a legend)." }
  };

  const SAVAGE_TIER = [
    { emoji: '💀', quote: 'Even the autotune filed a grievance.' },
    { emoji: '🚨', quote: 'The microphone is asking for a restraining order.' },
    { emoji: '📉', quote: 'Score: 404. Melody not found.' },
    { emoji: '🫣', quote: 'Pitch perfect! Assuming the pitch was a completely different song.' },
    { emoji: '🧅', quote: 'That performance had layers. Mostly making us cry.' },
    { emoji: '🕊️', quote: 'A moment of silence for the original artist.' },
    { emoji: '🔌', quote: 'We were this close to pulling the plug.' }
  ];

  const HYPE_TIER = [
    { emoji: '🔥', quote: 'Beyoncé is currently shaking.' },
    { emoji: '👑', quote: "We're shutting down the app. You just beat karaoke." },
    { emoji: '💸', quote: 'Are you accepting record deals? Asking for a friend.' },
    { emoji: '✨', quote: 'The vocal cords of an angel who just drank 3 Red Bulls.' },
    { emoji: '🏆', quote: 'Grammy pending. Please hold.' },
    { emoji: '🎤', quote: "You didn't just sing the song, you paid its mortgage." }
  ];

  const META_TIER = [
    { emoji: '🤖', quote: 'The algorithm is confused, but highly entertained.' },
    { emoji: '🎲', quote: "We rolled a dice for this score. You're welcome." },
    { emoji: '🧮', quote: "Math can't explain what just happened on that stage." },
    { emoji: '🛸', quote: 'Vocals so experimental they belong in Area 51.' },
    { emoji: '🤷‍♂️', quote: 'Look, the score is fake, but our love for you is real.' }
  ];

  function getPhraseForScore(score) {
    const num = Number(score);
    if (EASTER_EGG_SCORES[num]) return EASTER_EGG_SCORES[num];
    if (num >= 85) return HYPE_TIER[Math.floor(Math.random() * HYPE_TIER.length)];
    if (num < 60) return SAVAGE_TIER[Math.floor(Math.random() * SAVAGE_TIER.length)];
    const list = Math.random() > 0.4 ? META_TIER : (num >= 75 ? HYPE_TIER : SAVAGE_TIER);
    return list[Math.floor(Math.random() * list.length)];
  }

  function triggerScoreReveal() {
    if (!scoreRevealModal) {
      socket.emit('play_next');
      return;
    }

    // Pick target score
    const roll = Math.random();
    let targetScore = 88;
    if (roll < 0.05) targetScore = 69;
    else if (roll < 0.08) targetScore = 99;
    else if (roll < 0.10) targetScore = 100;
    else if (roll < 0.12) targetScore = 1;
    else targetScore = Math.floor(Math.random() * 56) + 45; // 45 - 100

    const phrase = getPhraseForScore(targetScore);

    // Setup modal state
    ksmScoreDisplay.textContent = '0';
    ksmPhraseDisplay.classList.remove('visible');
    ksmPhraseEmoji.textContent = phrase.emoji;
    ksmPhraseQuote.textContent = `"${phrase.quote}"`;
    scoreRevealModal.style.display = 'flex';

    const duration = 1500;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(ease * targetScore);
      
      ksmScoreDisplay.textContent = (targetScore === 1 && current === 1) ? '01' : current;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ksmScoreDisplay.textContent = (targetScore === 1) ? '01' : targetScore;
        ksmPhraseDisplay.classList.add('visible');

        // Play celebration reaction
        if (window.soundboard) {
          window.soundboard.play(targetScore >= 80 ? 'cheer' : 'rimshot');
        }

        // Auto-advance after 7 seconds
        clearTimeout(scoreModalTimer);
        scoreModalTimer = setTimeout(() => {
          closeScoreModal();
          socket.emit('play_next');
        }, 7000);
      }
    };

    requestAnimationFrame(animate);
  }

  function closeScoreModal() {
    clearTimeout(scoreModalTimer);
    if (scoreRevealModal) {
      scoreRevealModal.style.display = 'none';
    }
  }

  function onPlayerStateChange(event) {
    // YT.PlayerState.ENDED === 0
    if (event.data === 0) {
      console.log('[YouTube] Song finished playing, revealing Karaoke Score...');
      triggerScoreReveal();
    }
  }

  function onPlayerError(event) {
    console.warn('[YouTube] Player error code:', event.data);
    // 101/150 = embedding blocked by owner, 100 = not found, 2/5 = invalid id/HTML5 error
    if (event.data === 101 || event.data === 150 || event.data === 100) {
      nextUpTicker.innerHTML = `<span style="color: #ef4444;">⚠️ This video cannot be embedded. Skipping to next song in 3s...</span>`;
      setTimeout(() => {
        socket.emit('play_next');
      }, 3500);
    }
  }

  // 3. Start Song with 3-Second Transition Countdown
  function startSongWithCountdown(queuedItem) {
    currentSong = queuedItem;
    isTransitioning = true;

    // Show Countdown Banner
    countdownOverlay.classList.remove('hidden');
    countdownSinger.textContent = queuedItem.addedBy || 'Guest Singer';
    countdownSong.textContent = queuedItem.song.title;

    let count = 3;
    countdownNumber.textContent = count;

    // Play ready sound effect
    if (window.soundboard) {
      window.soundboard.play('rimshot');
    }

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
      } else {
        clearInterval(interval);
        countdownOverlay.classList.add('hidden');
        isTransitioning = false;

        // Start playback on YouTube
        if (isYtReady && ytPlayer && ytPlayer.loadVideoById) {
          try {
            ytPlayer.loadVideoById({
              videoId: queuedItem.song.id,
              startSeconds: 0
            });
          } catch (e) {
            console.error('Error loading video:', e);
          }
        }

        // Update UI
        idleStage.classList.add('hidden');
        nowSingingBar.classList.remove('hidden');
        nowSingingBar.classList.remove('dimmed');
        clearTimeout(nowSingingDimTimer);
        nowSingingDimTimer = setTimeout(() => {
          nowSingingBar.classList.add('dimmed');
        }, 7000);
        currentSongTitle.textContent = queuedItem.song.title;
        currentSongSinger.textContent = queuedItem.addedBy || 'Singer';
        currentSongArtist.textContent = queuedItem.song.artist || 'Karaoke';
      }
    }, 1000);
  }

  // 4. Update Room State (Singers count, Queue list, Ticker)
  function updateRoomState(state) {
    if (!state) return;

    singersCountBadge.textContent = `👥 ${state.userCount || 0} Singers Online`;
    queue = state.queue || [];
    queueCountBadge.textContent = queue.length;

    // Render Queue in Drawer
    renderQueueList(queue);

    // Update Bottom Ticker
    if (queue.length > 0) {
      const next = queue[0];
      nextUpTicker.innerHTML = `<strong>${next.song.title}</strong> — Reserved by <span class="singer-tag">${next.addedBy}</span>`;
    } else {
      nextUpTicker.textContent = currentSong 
        ? 'No more songs in queue. Be the next to queue up!' 
        : 'Queue is empty. Scan QR to reserve songs!';
    }
  }

  function renderQueueList(items) {
    if (!items || items.length === 0) {
      queueItemsList.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; margin-top: 40px; font-size: 0.9rem;">
          <p style="font-size: 2rem; margin-bottom: 8px;">🎶</p>
          <p>No songs reserved yet.<br>Scan the QR code to reserve!</p>
        </div>`;
      return;
    }

    queueItemsList.innerHTML = items.map((item, index) => `
      <div class="stage-queue-item">
        <div class="queue-num">#${index + 1}</div>
        <img class="queue-thumb" src="${item.song.thumbnail}" alt="" onerror="this.src='https://i.ytimg.com/vi/${item.song.id}/hqdefault.jpg'">
        <div class="queue-meta">
          <h4>${item.song.title}</h4>
          <p>Reserved by: <span class="singer-tag">${item.addedBy}</span> • ${item.song.duration}</p>
        </div>
      </div>
    `).join('');
  }

  // 5. Soundboard Reactions from Audience
  function handleIncomingReaction(type, sender) {
    // 1. Play Synthesized Sound via Web Audio API (Zero Latency)
    if (window.soundboard) {
      window.soundboard.play(type);
    }

    // 2. Spawn Floating Emoji Visual
    const emojiMap = {
      airhorn: '📢',
      applause: '👏',
      cheer: '🎉',
      rimshot: '🥁',
      partyhorn: '🎺',
      heart: '💖'
    };

    const emoji = emojiMap[type] || '🔥';
    const reactionEl = document.createElement('div');
    reactionEl.className = 'reaction-floating-item';
    reactionEl.textContent = emoji;

    // Randomize horizontal position across the stage screen
    const leftPercent = Math.floor(Math.random() * 70) + 15;
    reactionEl.style.left = `${leftPercent}%`;

    reactionsContainer.appendChild(reactionEl);

    // Clean up DOM after animation
    setTimeout(() => {
      if (reactionEl.parentNode) {
        reactionEl.parentNode.removeChild(reactionEl);
      }
    }, 3100);
  }

  // Toast Notification on Stage (New song queued or singer joined)
  function showStageToast(html) {
    const existing = document.querySelector('.stage-live-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'stage-live-toast';
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 30px;
      background: rgba(18, 9, 38, 0.96);
      border: 2px solid var(--neon-cyan);
      box-shadow: 0 0 25px var(--neon-cyan-glow), 0 10px 30px rgba(0,0,0,0.85);
      color: #fff;
      padding: 12px 22px;
      border-radius: var(--radius-md);
      font-size: 1.05rem;
      font-weight: 700;
      z-index: 1000;
      pointer-events: none;
      animation: ksmFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.innerHTML = html;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 4500);
  }

  // 6. Bind Event Listeners
  function bindEvents() {
    // Unlock Web Audio on first click
    document.body.addEventListener('click', () => {
      if (window.soundboard) window.soundboard.init();
    }, { once: true });

    // Donate Modal Events
    if (toggleDonateBtn) {
      toggleDonateBtn.addEventListener('click', () => {
        tvDonateModal.classList.remove('hidden');
      });
    }

    if (idleDonateBtn) {
      idleDonateBtn.addEventListener('click', () => {
        tvDonateModal.classList.remove('hidden');
      });
    }

    if (closeDonateModalBtn) {
      closeDonateModalBtn.addEventListener('click', () => {
        tvDonateModal.classList.add('hidden');
      });
    }

    if (tvDonateModal) {
      tvDonateModal.addEventListener('click', (e) => {
        if (e.target === tvDonateModal) {
          tvDonateModal.classList.add('hidden');
        }
      });
    }

    // Stage Big QR Modal Functions (For Smart TVs and easy room scanning)
    function openTvQrModal() {
      if (!tvQrModal) return;
      if (currentRoomCode && modalRoomCode) modalRoomCode.textContent = currentRoomCode;
      if (qrImage && modalQrImage && qrImage.src) modalQrImage.src = qrImage.src;
      if (qrUrlText && modalQrUrlText && qrUrlText.textContent) modalQrUrlText.textContent = qrUrlText.textContent;
      tvQrModal.classList.remove('hidden');
    }

    function closeTvQrModal() {
      if (tvQrModal) tvQrModal.classList.add('hidden');
    }

    if (toggleQrBtn) {
      toggleQrBtn.addEventListener('click', () => {
        if (tvQrModal && !tvQrModal.classList.contains('hidden')) {
          closeTvQrModal();
        } else {
          openTvQrModal();
        }
      });
    }

    if (expandQrBtn) {
      expandQrBtn.addEventListener('click', () => {
        openTvQrModal();
      });
    }

    if (expandQrModalBtn) {
      expandQrModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTvQrModal();
      });
    }

    if (qrImage) {
      qrImage.addEventListener('click', (e) => {
        e.stopPropagation();
        openTvQrModal();
      });
    }

    if (closeQrModalBtn) {
      closeQrModalBtn.addEventListener('click', () => {
        closeTvQrModal();
      });
    }

    if (tvQrModal) {
      tvQrModal.addEventListener('click', (e) => {
        if (e.target === tvQrModal) {
          closeTvQrModal();
        }
      });
    }

    // Floating QR Code Widget (Minimize / Restore)
    function toggleQrWidgetMinimize() {
      if (!qrWidget) return;
      qrWidget.classList.toggle('minimized');
      const isMin = qrWidget.classList.contains('minimized');
      if (minimizeQrBtn) {
        minimizeQrBtn.textContent = isMin ? '▲' : '−';
        minimizeQrBtn.title = isMin ? 'Restore QR Code' : 'Minimize QR Code';
      }
    }

    if (minimizeQrBtn) {
      minimizeQrBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQrWidgetMinimize();
      });
    }

    if (qrWidget) {
      qrWidget.addEventListener('click', (e) => {
        if (qrWidget.classList.contains('minimized')) {
          toggleQrWidgetMinimize();
        }
      });
    }

    // Now Singing Bar: Hover or Tap restores full brightness
    if (nowSingingBar) {
      nowSingingBar.addEventListener('mouseenter', () => {
        nowSingingBar.classList.remove('dimmed');
      });
      nowSingingBar.addEventListener('mouseleave', () => {
        if (currentSong) {
          clearTimeout(nowSingingDimTimer);
          nowSingingDimTimer = setTimeout(() => {
            nowSingingBar.classList.add('dimmed');
          }, 3500);
        }
      });
      nowSingingBar.addEventListener('click', () => {
        nowSingingBar.classList.remove('dimmed');
      });
    }

    // Keyboard Shortcuts: Q for Big QR, Esc to close modals
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'q' || e.key === 'Q') {
        if (tvQrModal && !tvQrModal.classList.contains('hidden')) {
          closeTvQrModal();
        } else {
          openTvQrModal();
        }
      }

      if (e.key === 'Escape') {
        closeTvQrModal();
        if (tvDonateModal) tvDonateModal.classList.add('hidden');
        closeScoreModal();
      }
    });

    // Toggle Queue Drawer
    toggleQueueBtn.addEventListener('click', () => {
      stageQueueDrawer.classList.toggle('closed');
    });

    closeDrawerBtn.addEventListener('click', () => {
      stageQueueDrawer.classList.add('closed');
    });

    // Score Modal Buttons
    if (ksmNextQueueBtn) {
      ksmNextQueueBtn.addEventListener('click', () => {
        closeScoreModal();
        socket.emit('play_next');
      });
    }

    if (ksmSingAgainBtn) {
      ksmSingAgainBtn.addEventListener('click', () => {
        closeScoreModal();
        if (ytPlayer && ytPlayer.seekTo) {
          ytPlayer.seekTo(0);
          ytPlayer.playVideo();
        }
      });
    }

    // Resolution Mode Toggle (Auto / Safe 90% / Fill)
    const resModes = [
      { id: 'auto', label: '📐 Auto Res', toast: '📐 Resolution: Auto Fit (Responsive 16:9)' },
      { id: 'safe', label: '📐 TV Safe (90%)', toast: '📐 Resolution: TV Safe Zone (90% Scale)' },
      { id: 'fill', label: '📐 Fill Arena', toast: '📐 Resolution: Full Arena Fill' }
    ];

    let currentResIdx = 0;
    const savedResMode = localStorage.getItem('singtunado_res_mode');
    if (savedResMode) {
      const idx = resModes.findIndex(m => m.id === savedResMode);
      if (idx !== -1) currentResIdx = idx;
    }

    function applyResMode(idx, notify = false) {
      const mode = resModes[idx];
      document.body.classList.remove('res-mode-safe', 'res-mode-fill');
      if (mode.id === 'safe') document.body.classList.add('res-mode-safe');
      if (mode.id === 'fill') document.body.classList.add('res-mode-fill');
      if (resModeBtn) resModeBtn.textContent = mode.label;
      localStorage.setItem('singtunado_res_mode', mode.id);
      if (notify) showStageToast(mode.toast);
    }

    applyResMode(currentResIdx, false);

    if (resModeBtn) {
      resModeBtn.addEventListener('click', () => {
        currentResIdx = (currentResIdx + 1) % resModes.length;
        applyResMode(currentResIdx, true);
      });
    }

    // Fullscreen Toggle
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Skip Song
    skipSongBtn.addEventListener('click', () => {
      if (confirm('Skip to the next song in the queue?')) {
        socket.emit('play_next');
      }
    });

    // Replay Song
    replaySongBtn.addEventListener('click', () => {
      if (ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(0);
        ytPlayer.playVideo();
      }
    });

    // Start with a Classic Anthem (Instant Party Starter)
    startStarterBtn.addEventListener('click', () => {
      socket.emit('queue_add', {
        song: {
          id: '1hAmBPNhaFs',
          title: 'Ang Huling El Bimbo',
          artist: 'Eraserheads',
          duration: '7:25',
          thumbnail: 'https://i.ytimg.com/vi/1hAmBPNhaFs/hqdefault.jpg'
        },
        addedBy: 'Host DJ',
        addToTop: true
      });
    });
  }

  // Kickoff
  init();
})();
