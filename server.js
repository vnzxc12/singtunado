const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const yts = require('yt-search');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Helper: Get local network IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Middleware & Static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Room & Queue Store
const rooms = new Map();

// Helper: Generate unique 4-character room code (e.g. SING, ROCK, BEAT, 4821)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Curated Popular Karaoke Hits for instant party start
const CURATED_SONGS = [
  {
    category: '🔥 Party Anthems',
    songs: [
      { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
      { id: '1k8craCGpgs', title: 'Don\'t Stop Believin\'', artist: 'Journey', duration: '4:11', thumbnail: 'https://i.ytimg.com/vi/1k8craCGpgs/hqdefault.jpg' },
      { id: '09R8_2nJtjg', title: 'Sugar', artist: 'Maroon 5', duration: '3:55', thumbnail: 'https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg' },
      { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '3:48', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
      { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' }
    ]
  },
  {
    category: '🎤 Crowd Favorites & Classics',
    songs: [
      { id: 'My2FRPA3Gf8', title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston', duration: '4:52', thumbnail: 'https://i.ytimg.com/vi/My2FRPA3Gf8/hqdefault.jpg' },
      { id: 'NF-kLy44Hls', title: 'Sweet Caroline', artist: 'Neil Diamond', duration: '3:21', thumbnail: 'https://i.ytimg.com/vi/NF-kLy44Hls/hqdefault.jpg' },
      { id: 'yURRmWtbTbo', title: 'Hotel California', artist: 'Eagles', duration: '6:30', thumbnail: 'https://i.ytimg.com/vi/yURRmWtbTbo/hqdefault.jpg' },
      { id: 'rYEDA3JcQqw', title: 'Rolling in the Deep', artist: 'Adele', duration: '3:48', thumbnail: 'https://i.ytimg.com/vi/rYEDA3JcQqw/hqdefault.jpg' },
      { id: 'ZbZSe6N_BXs', title: 'Happy', artist: 'Pharrell Williams', duration: '3:53', thumbnail: 'https://i.ytimg.com/vi/ZbZSe6N_BXs/hqdefault.jpg' }
    ]
  },
  {
    category: '🇵🇭 Pinoy Karaoke Essentials',
    songs: [
      { id: '1hAmBPNhaFs', title: 'Ang Huling El Bimbo', artist: 'Eraserheads', duration: '7:25', thumbnail: 'https://i.ytimg.com/vi/1hAmBPNhaFs/hqdefault.jpg' },
      { id: 'r_8qEHQWJ18', title: 'Halik', artist: 'Aegis', duration: '4:50', thumbnail: 'https://i.ytimg.com/vi/r_8qEHQWJ18/hqdefault.jpg' },
      { id: '7j3nQ2Hn26E', title: 'Luha', artist: 'Aegis', duration: '4:45', thumbnail: 'https://i.ytimg.com/vi/7j3nQ2Hn26E/hqdefault.jpg' },
      { id: '09m0B8RRgEE', title: 'With a Smile', artist: 'Eraserheads', duration: '4:24', thumbnail: 'https://i.ytimg.com/vi/09m0B8RRgEE/hqdefault.jpg' },
      { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', duration: '4:23', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg' }
    ]
  }
];

// API: Server & Network Info
app.get('/api/info', (req, res) => {
  res.json({
    localIp: LOCAL_IP,
    port: PORT,
    remoteUrlTemplate: `http://${LOCAL_IP}:${PORT}/remote.html?room=`
  });
});

// API: Curated songs
app.get('/api/curated', (req, res) => {
  res.json(CURATED_SONGS);
});

// API: YouTube Search proxy using yt-search
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json({ results: [] });
  }

  try {
    // Append 'karaoke' if not already in the search terms for optimal karaoke results
    const searchQuery = /karaoke|instrumental|minus one/i.test(query) ? query : `${query} karaoke`;
    const searchResult = await yts(searchQuery);

    const videos = (searchResult.videos || []).slice(0, 20).map(v => ({
      id: v.videoId,
      title: v.title.replace(/[\(\[](Karaoke|Karaoke Version|Instrumental|Lyrics|HD|Official)[\)\]]/gi, '').trim(),
      fullTitle: v.title,
      artist: v.author ? v.author.name : 'Unknown Artist',
      duration: v.timestamp || '3:30',
      seconds: v.seconds || 210,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      views: v.views
    }));

    res.json({ results: videos });
  } catch (err) {
    console.error('[Search Error]', err.message);
    res.status(500).json({ error: 'Search failed', results: [] });
  }
});

// API: Generate QR Code data URL
app.get('/api/qrcode', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).send('Missing text query');
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    res.json({ dataUrl: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// Helper: Ensure room state structure
function getOrCreateRoom(roomCode) {
  const code = roomCode.toUpperCase();
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      createdAt: Date.now(),
      hostSocketId: null,
      currentSong: null,
      queue: [],
      history: [],
      users: new Map(), // socketId -> { name, joinedAt }
      playback: {
        isPlaying: false,
        currentTime: 0,
        volume: 100
      }
    });
  }
  return rooms.get(code);
}

// Helper: Format public room state for broadcasting
function sanitizeRoomState(room) {
  return {
    code: room.code,
    currentSong: room.currentSong,
    queue: room.queue,
    history: room.history.slice(-10),
    userCount: room.users.size,
    users: Array.from(room.users.values()),
    playback: room.playback
  };
}

// Socket.io Real-Time Synchronization
io.on('connection', (socket) => {
  let userRoom = null;
  let userName = 'Guest Singer';
  let isHost = false;

  // 1. Host registers or creates room
  socket.on('host_create_room', async ({ customCode, hostUrl } = {}, callback) => {
    const code = customCode ? customCode.toUpperCase() : generateRoomCode();
    const room = getOrCreateRoom(code);
    room.hostSocketId = socket.id;
    userRoom = code;
    isHost = true;
    socket.join(code);

    let baseUrl = hostUrl || process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = (LOCAL_IP && LOCAL_IP !== 'localhost') ? `http://${LOCAL_IP}:${PORT}` : `http://localhost:${PORT}`;
    }
    const remoteUrl = `${baseUrl}/remote.html?room=${code}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(remoteUrl, { width: 320, margin: 2 });
    } catch (e) {
      console.error('Failed generating QR in socket:', e);
    }

    if (callback) {
      callback({
        success: true,
        roomCode: code,
        remoteUrl,
        qrDataUrl,
        state: sanitizeRoomState(room)
      });
    }

    io.to(code).emit('room_state_updated', sanitizeRoomState(room));
    console.log(`[Host Created Room] ${code} (Host Socket: ${socket.id})`);
  });

  // 2. Mobile User or Client joins room
  socket.on('join_room', ({ roomCode, name }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    if (!rooms.has(code)) {
      if (callback) callback({ success: false, error: `Room "${code}" not found. Please check the TV screen code!` });
      return;
    }

    const room = rooms.get(code);
    userRoom = code;
    userName = (name || 'Guest Singer').trim();

    room.users.set(socket.id, {
      id: socket.id,
      name: userName,
      joinedAt: Date.now()
    });

    socket.join(code);

    if (callback) {
      callback({
        success: true,
        roomCode: code,
        state: sanitizeRoomState(room)
      });
    }

    io.to(code).emit('room_state_updated', sanitizeRoomState(room));
    io.to(code).emit('user_joined_announcement', { name: userName });
    console.log(`[User Joined] "${userName}" joined room ${code}`);
  });

  // 3. User updates their nickname
  socket.on('update_name', ({ name }) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const room = rooms.get(userRoom);
    userName = (name || 'Guest Singer').trim();
    if (room.users.has(socket.id)) {
      room.users.get(socket.id).name = userName;
    }
    io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
  });

  // 4. Reserve / Add Song to Queue
  socket.on('queue_add', ({ song, addedBy, addToTop }, callback) => {
    if (!userRoom || !rooms.has(userRoom)) {
      if (callback) callback({ success: false, error: 'Not in an active room' });
      return;
    }

    const room = rooms.get(userRoom);

    // Queue limit: 20 songs max per room
    if (room.queue.length >= 20) {
      if (callback) callback({ success: false, error: 'Queue is full (max 20 songs). Please wait for songs to finish!' });
      return;
    }

    const queueItem = {
      queueId: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist || 'Unknown Artist',
        duration: song.duration || '3:30',
        thumbnail: song.thumbnail || `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`
      },
      addedBy: (addedBy || userName || 'Singer').trim(),
      addedAt: Date.now(),
      status: 'waiting'
    };

    if (addToTop) {
      room.queue.unshift(queueItem);
    } else {
      room.queue.push(queueItem);
    }

    // If no song is currently playing, start playing immediately!
    if (!room.currentSong) {
      room.currentSong = room.queue.shift();
      room.playback.isPlaying = true;
      room.playback.currentTime = 0;
      io.to(userRoom).emit('song_started', { song: room.currentSong });
    }

    io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
    io.to(userRoom).emit('song_queued_notification', {
      title: queueItem.song.title,
      singer: queueItem.addedBy,
      position: addToTop ? 1 : room.queue.length
    });

    if (callback) callback({ success: true, queueId: queueItem.queueId, position: addToTop ? 1 : room.queue.length });
    console.log(`[Song Queued in ${userRoom}] "${queueItem.song.title}" by ${queueItem.addedBy}`);
  });

  // 5. Remove song from queue
  socket.on('queue_remove', ({ queueId }, callback) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const room = rooms.get(userRoom);
    const index = room.queue.findIndex(item => item.queueId === queueId);
    if (index !== -1) {
      const removed = room.queue.splice(index, 1)[0];
      io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
      if (callback) callback({ success: true, removed });
    }
  });

  // 6. Move song to top of queue (priority pass)
  socket.on('queue_move_top', ({ queueId }) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const room = rooms.get(userRoom);
    const index = room.queue.findIndex(item => item.queueId === queueId);
    if (index > 0) {
      const item = room.queue.splice(index, 1)[0];
      room.queue.unshift(item);
      io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
    }
  });

  // 7. Skip / Play Next Song (invoked by TV Host or Mobile Host)
  socket.on('play_next', (callback) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const room = rooms.get(userRoom);

    if (room.currentSong) {
      room.history.push({ ...room.currentSong, endedAt: Date.now() });
    }

    if (room.queue.length > 0) {
      room.currentSong = room.queue.shift();
      room.playback.isPlaying = true;
      room.playback.currentTime = 0;
      io.to(userRoom).emit('song_started', { song: room.currentSong });
    } else {
      room.currentSong = null;
      room.playback.isPlaying = false;
      io.to(userRoom).emit('queue_ended');
    }

    io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
    if (callback) callback({ success: true, currentSong: room.currentSong });
  });

  // 8. Replay Current Song
  socket.on('replay_current', () => {
    if (!userRoom || !rooms.has(userRoom)) return;
    io.to(userRoom).emit('host_command', { action: 'replay' });
  });

  // 9. Playback controls (Play, Pause, Volume)
  socket.on('playback_action', ({ action, value }) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const room = rooms.get(userRoom);
    if (action === 'pause') room.playback.isPlaying = false;
    if (action === 'play') room.playback.isPlaying = true;
    if (action === 'volume') room.playback.volume = value;

    // Relay command directly to TV host
    io.to(userRoom).emit('host_command', { action, value });
    io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
  });

  // 10. Soundboard Reaction (Applause, Cheer, Airhorn, Boo, Heart)
  socket.on('sound_reaction', ({ type, sender }) => {
    if (!userRoom || !rooms.has(userRoom)) return;
    const reactionSender = sender || userName || 'Singer';
    console.log(`[Reaction in ${userRoom}] ${type} from ${reactionSender}`);

    // Broadcast reaction to Host (plays sound & shows big emoji animation)
    io.to(userRoom).emit('play_reaction', {
      type,
      sender: reactionSender,
      timestamp: Date.now()
    });
  });

  // 11. Disconnect
  socket.on('disconnect', () => {
    if (userRoom && rooms.has(userRoom)) {
      const room = rooms.get(userRoom);
      room.users.delete(socket.id);

      // If host disconnected, give a short grace period before considering room orphaned
      if (room.hostSocketId === socket.id) {
        console.log(`[Host Disconnected from ${userRoom}]`);
      }

      io.to(userRoom).emit('room_state_updated', sanitizeRoomState(room));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  🎤 Singtunado Wireless Karaoke Server is RUNNING!`);
  console.log(`======================================================`);
  console.log(`  Local TV Host URL:    http://localhost:${PORT}/host.html`);
  console.log(`  Mobile Remote URL:    http://${LOCAL_IP}:${PORT}/remote.html`);
  console.log(`  Main Landing URL:     http://${LOCAL_IP}:${PORT}/`);
  console.log(`======================================================\n`);
});
