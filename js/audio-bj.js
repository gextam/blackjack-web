/* ============================================================================
   BLACKJACK — sound: card slides, snaps and flips, the shoe, chips, shuffle,
   win chimes, bust thud, table ambience and the dealer's voice clips.
   Built on the shared synthesizer engine (ZEUS.AudioEngine in audio.js).
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ, ZEUS = root.ZEUS;
  const A = BJ.audio = new ZEUS.AudioEngine();
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  A.cardSlide = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 2600, freqEnd: 1400, sweep: 0.14, Q: 1.2, gain: 0.16, a: 0.01, d: 0.1, s: 0.4, r: 0.06, dur: 0.14 }); };
  A.cardSnap = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'highpass', freq: 1800, gain: 0.22, dur: 0.012, d: 0.02, s: 0.1, r: 0.03 }); this.tone({ t: t, freq: 420, freqEnd: 260, sweep: 0.04, gain: 0.06, a: 0.001, d: 0.04, s: 0.05, r: 0.03, dur: 0.04 }); };
  A.cardFlip = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 3200, Q: 2, gain: 0.14, dur: 0.05, a: 0.005, d: 0.05, s: 0.3, r: 0.04 }); this.noise({ t: t + 0.07, type: 'highpass', freq: 2200, gain: 0.18, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); };
  A.shoePull = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 900, freqEnd: 2400, sweep: 0.12, Q: 1, gain: 0.1, a: 0.01, d: 0.1, s: 0.3, r: 0.05, dur: 0.12 }); };
  A.shuffle = function () {
    if (!this.ready) return; const t = this.now();
    for (let k = 0; k < 14; k++) this.noise({ t: t + k * 0.055 + Math.random() * 0.02, type: 'bandpass', freq: 2200 + Math.random() * 1200, Q: 1.5, gain: 0.12, dur: 0.02, d: 0.03, s: 0.2, r: 0.03 });
    this.noise({ t: t + 0.9, type: 'bandpass', freq: 1500, freqEnd: 600, sweep: 0.3, Q: 1, gain: 0.14, a: 0.01, d: 0.25, s: 0.3, r: 0.1, dur: 0.3 });
  };
  A.chipPlace = function () { if (!this.ready) return; const t = this.now(), k = 0.95 + Math.random() * 0.1; this.tone({ t: t, freq: 2350 * k, gain: 0.09, a: 0.001, d: 0.05, s: 0.02, r: 0.03, dur: 0.05 }); this.tone({ t: t + 0.012, freq: 3100 * k, gain: 0.05, a: 0.001, d: 0.04, s: 0.02, r: 0.03, dur: 0.04 }); this.noise({ t: t, type: 'bandpass', freq: 4200, Q: 3, gain: 0.12, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); };
  A.chipTake = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 1500, freqEnd: 600, sweep: 0.3, Q: 0.8, gain: 0.12, a: 0.02, d: 0.25, s: 0.3, r: 0.1, dur: 0.3 }); for (let k = 0; k < 4; k++) this.noise({ t: t + 0.03 + Math.random() * 0.25, type: 'bandpass', freq: 3000 + Math.random() * 1500, Q: 3, gain: 0.07, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); };
  A.chipPay = function (n) { if (!this.ready) return; const t = this.now(), m = Math.min(12, Math.max(2, n)); for (let k = 0; k < m; k++) { const tt = t + k * 0.07; this.tone({ t: tt, freq: 2100 + Math.random() * 500, gain: 0.07, a: 0.001, d: 0.05, s: 0.02, r: 0.03, dur: 0.05 }); this.noise({ t: tt, type: 'bandpass', freq: 4000, Q: 3, gain: 0.08, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); } };
  A.winChime = function (big) { if (!this.ready) return; const t = this.now(); [76, 80, 83, 88].slice(0, big ? 4 : 3).forEach((n, i) => this.bell(midi(n), t + i * 0.08, { gain: 0.1, dur: 1.1 })); if (big) [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, k) => ch.forEach(n => this.brass(midi(n), t + 0.3 + k * 0.3, k === 3 ? 1.2 : 0.26, 0.08))); };
  A.bustThud = function () { if (!this.ready) return; const t = this.now(); this.thump(t, { freq: 110, gain: 0.45, dur: 0.14 }); this.tone({ t: t + 0.05, type: 'square', freq: 180, freqEnd: 120, sweep: 0.2, gain: 0.05, a: 0.005, d: 0.2, s: 0.2, r: 0.1, dur: 0.2, filter: { type: 'lowpass', freq: 900 } }); };
  A.pushTone = function () { if (!this.ready) return; const t = this.now(); this.tone({ t: t, freq: 660, gain: 0.08, a: 0.005, d: 0.2, s: 0.2, r: 0.1, dur: 0.2 }); this.tone({ t: t + 0.12, freq: 660, gain: 0.08, a: 0.005, d: 0.2, s: 0.2, r: 0.1, dur: 0.2 }); };
  A.deny = function () { if (!this.ready) return; this.tone({ t: this.now(), type: 'square', freq: 170, gain: 0.06, a: 0.005, d: 0.12, s: 0.5, r: 0.05, dur: 0.14, filter: { type: 'lowpass', freq: 900 } }); };
  A.uiTick = function () { if (!this.ready) return; this.tone({ t: this.now(), freq: 1800, gain: 0.05, a: 0.001, d: 0.03, s: 0.1, r: 0.02, dur: 0.03 }); };

  /* ambience: soft card-room murmur */
  A.startAmbience = function () {
    if (!this.ready || this._amb) return; const ctx = this.ctx, t = this.now();
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.music); src.start(t); g.gain.setTargetAtTime(0.03, t, 2);
    this._amb = { src: src, g: g, timer: setInterval(() => { if (Math.random() < 0.6) this.noise({ t: this.now() + Math.random() * 0.4, type: 'bandpass', freq: 250 + Math.random() * 450, Q: 3, gain: 0.025, a: 0.04, d: 0.15, s: 0.4, r: 0.2, dur: 0.15 + Math.random() * 0.2, dest: this.music }); if (Math.random() < 0.2) this.bell(2600 + Math.random() * 2200, this.now() + Math.random() * 0.5, { gain: 0.01, dur: 0.3, dest: this.music }); }, 800) };
  };
  A.stopAmbience = function () { const a = this._amb; if (!a) return; clearInterval(a.timer); a.g.gain.setTargetAtTime(0, this.now(), 0.5); a.src.stop(this.now() + 2); this._amb = null; };

  /* dealer voice clips */
  A.clipsRaw = {}; A.clips = {};
  A.preloadClip = function (name, url) { if (!root.fetch) return; fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => { if (buf) this.clipsRaw[name] = buf; }).catch(() => {}); };
  A.hasClip = function (name) { return !!(this.clipsRaw[name] || this.clips[name]); };
  A.playClip = function (name, gain) {
    if (!this.ready || !this.hasClip(name) || this.muted) return Promise.resolve(0);
    const play = ab => new Promise(resolve => { const src = this.ctx.createBufferSource(); src.buffer = ab; const g = this._g(gain || 0.9, this.sfx, 0.2); src.connect(g); src.onended = () => resolve(ab.duration); src.start(); });
    if (this.clips[name]) return play(this.clips[name]);
    return this.ctx.decodeAudioData(this.clipsRaw[name].slice(0)).then(ab => { this.clips[name] = ab; return play(ab); }).catch(() => 0);
  };
})(window);
