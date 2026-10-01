/**
 * Singtunado Soundboard Synthesizer
 * Uses Web Audio API to generate zero-latency, 100% reliable crowd reactions:
 * - Airhorn 📢
 * - Applause / Clapping 👏
 * - Crowd Cheer 🎉
 * - Rimshot (Ba-dum-tss) 🥁
 * - Party Horn 🎺
 */

class SoundboardSynthesizer {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
  }

  // AudioContext requires user interaction on browser to unlock
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isUnlocked = true;
  }

  // Play reaction sound by key
  play(type) {
    this.init();
    if (!this.ctx) return;

    switch (type) {
      case 'airhorn':
        this.playAirhorn();
        break;
      case 'applause':
        this.playApplause();
        break;
      case 'cheer':
        this.playCheer();
        break;
      case 'rimshot':
        this.playRimshot();
        break;
      case 'partyhorn':
        this.playPartyHorn();
        break;
      default:
        this.playAirhorn();
    }
  }

  // 1. Classic Party Airhorn 📢 (Three sawtooth oscillators with pitch bending)
  playAirhorn() {
    const t = this.ctx.currentTime;
    const freqs = [155, 185, 233]; // Classic airhorn harmonic triad

    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.15);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t + 0.35);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.setValueAtTime(0.25, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      // Staccato bursts: burst 1
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);

      // Burst 2 (follow-up blast)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, t + 0.5);
      osc2.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.65);

      gain2.gain.setValueAtTime(0, t + 0.5);
      gain2.gain.linearRampToValueAtTime(0.25, t + 0.52);
      gain2.gain.setValueAtTime(0.25, t + 0.85);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.5);
      osc2.stop(t + 1.1);
    });
  }

  // 2. Realistic Clapping / Applause 👏 (Granular noise bursts)
  playApplause() {
    const t = this.ctx.currentTime;
    const duration = 2.5;

    // Buffer noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    // Bandpass filter for hand clapping resonance
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.4);
    gain.gain.setValueAtTime(0.4, t + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + duration);
  }

  // 3. Stadium Crowd Cheer 🎉 (Swept noise + uplifting brass chords)
  playCheer() {
    const t = this.ctx.currentTime;
    const duration = 2.8;

    // Crowd roar noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    filter.frequency.exponentialRampToValueAtTime(1200, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.5);
    gain.gain.setValueAtTime(0.35, t + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // 4. Rimshot (Ba-dum-tss) 🥁
  playRimshot() {
    const t = this.ctx.currentTime;

    // Strike 1 ("Ba")
    this.synthDrum(t, 180, 0.12, 0.3);
    // Strike 2 ("Dum")
    this.synthDrum(t + 0.18, 140, 0.15, 0.35);
    // Crash ("Tss")
    this.synthCymbal(t + 0.38, 0.8, 0.3);
  }

  synthDrum(time, freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + dur);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  synthCymbal(time, dur, vol) {
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(time);
    noise.stop(time + dur);
  }

  // 5. Party Horn 🎺
  playPartyHorn() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(440, t + 0.25);
    osc.frequency.linearRampToValueAtTime(520, t + 0.6);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.setValueAtTime(0.3, t + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.85);
  }
}

// Global instance
window.soundboard = new SoundboardSynthesizer();
