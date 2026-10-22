// 极简 WebAudio 音效管理器（无需外部音频资源）
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (typeof window === "undefined") return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
  }

  tone(freq, dur, type = "square", vol = 0.05, slideTo = null) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      }
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) {
      /* ignore */
    }
  }

  noise(dur = 0.25, vol = 0.08) {
    if (!this.ctx || this.muted) return;
    try {
      const rate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, Math.floor(rate * dur), rate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    } catch (e) {
      /* ignore */
    }
  }

  shoot() {
    this.tone(760, 0.06, "square", 0.025, 260);
  }

  enemyShoot() {
    this.tone(320, 0.08, "square", 0.018, 140);
  }

  hit() {
    this.tone(180, 0.07, "square", 0.035, 70);
  }

  explosion() {
    this.noise(0.3, 0.09);
    this.tone(110, 0.3, "sawtooth", 0.05, 35);
  }

  powerup() {
    this.tone(660, 0.08, "triangle", 0.05);
    setTimeout(() => this.tone(990, 0.12, "triangle", 0.05), 80);
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.14, "triangle", 0.05), i * 90)
    );
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.3, "sawtooth", 0.045), i * 160)
    );
  }
}

export const sound = new SoundManager();
