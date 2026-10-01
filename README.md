# 🎤 Singtunado — Wireless Karaoke Player & Mobile Remote

> Real-time web-based karaoke system with TV Host Stage, live synchronized song reservation queue, instant QR code phone pairing, crowd soundboard reactions, and YouTube search.

---

## 🌟 Key Features

1. **📺 TV Host Stage (`/host.html`)**:
   - Designed for Smart TVs, laptops, and projectors with fullscreen presentation mode.
   - Dynamic **QR Code** and 4-letter **Room Code** generation for zero-install mobile pairing.
   - Integrated YouTube Karaoke video player with automatic transition to the next queued track.
   - 3-second stage countdown banner announcing the next singer ("🎙️ Get ready, Alex!").
   - Live upcoming queue drawer and "Now Singing" banner.
   - Real-time receiver for crowd soundboard reactions (airhorns, applause, cheering).

2. **📱 Mobile Remote Controller (`/remote.html`)**:
   - Zero app download required — opens in any smartphone camera/browser.
   - **Songbook & YouTube Search**: Search millions of karaoke tracks directly or pick from curated party hits.
   - **Instant Song Reservation**: Add songs with your nickname, with priority "⚡ Play Next" option.
   - **Live Queue Management**: View your place in line and remove your own reserved tracks.
   - **Crowd Soundboard**: Trigger instant airhorns, applause, cheering, and rimshots that play out loud through the TV speakers with tactile haptic vibration!
   - **Wireless Remote Controls**: Play/pause, replay, or skip tracks from the sofa.

3. **⚡ Zero-Latency Web Audio Synthesizer**:
   - Built-in Web Audio synthesis for airhorn blasts, crowd applause noise envelopes, and rimshot drums — 100% reliable with zero dependency on third-party audio CDN uptime.

4. **📡 Real-Time WebSocket Synchronization**:
   - Powered by Node.js + Socket.io with local network IP auto-detection (`os.networkInterfaces`).

---

## 🚀 Quick Start

### 1. Install & Start
```bash
npm install
node server.js
```

### 2. Access the Application
- **Main Portal**: `http://localhost:3000/`
- **TV Host Stage**: `http://localhost:3000/host.html`
- **Mobile Remote**: `http://<your-local-ip>:3000/remote.html?room=<ROOM_CODE>`

> **Tip for Phone Testing**: When running on the same Wi-Fi network, point your phone camera at the QR code displayed on the TV screen. Your phone will open the mobile remote and connect to the room automatically!

---

## 🛠️ Project Structure

- `server.js` — Express + Socket.io server, LAN IP discovery, YouTube search scraper (`yt-search`), and in-memory room/queue manager.
- `public/index.html` — Landing page with Host TV Stage and Mobile Remote quick links.
- `public/host.html` & `public/js/host.js` — Big-screen TV stage with YouTube Iframe API and reaction particle animations.
- `public/remote.html` & `public/js/remote.js` — Mobile songbook, reservation system, and soundboard controller.
- `public/js/soundboard.js` — Zero-latency Web Audio API sound synthesizers (airhorn, applause, cheer, rimshot).
- `public/css/` — Modern dark glassmorphic styling, responsive layout, and typography.

---

## ☁️ Deploy to Render (Free 24/7 Cloud Hosting)

Singtunado is fully configured for continuous real-time WebSockets on **[Render.com](https://render.com/)**:

1. Push your code to GitHub: `https://github.com/vnzxc12/singtunado`
2. Go to **[dashboard.render.com](https://dashboard.render.com/)** and sign in.
3. Click **New +** → **Web Service**.
4. Connect your **`singtunado`** GitHub repository.
5. Render will auto-fill:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Click **Deploy Web Service**!
7. Once deployed, Render gives you a live public HTTPS URL (e.g. `https://singtunado.onrender.com`).
   - Open `/host.html` on your Smart TV or projector.
   - The TV stage QR code automatically points to the cloud URL, allowing any guest on Wi-Fi or mobile cellular data to join instantly!
