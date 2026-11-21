// SHADOWLINE — WebAudio synth, no audio files.
// One file, one job: footsteps, alert stings, pickups, lure pings, ambience.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let stepAcc = 0;
  let hum = null;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, gain, lowpass) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },

    // Alternating soft steps; running steps are louder and closer together.
    footstep(running, dt) {
      stepAcc += dt * (running ? 5.2 : 2.6);
      if (stepAcc < 1) return;
      stepAcc -= 1;
      noiseBurst(0.07, running ? 0.10 : 0.045, running ? 900 : 500);
    },

    ping() { tone(1320, 0.35, 'sine', 0.12, 0, 880); }, // lure coin
    pickup() { tone(660, 0.12, 'sine', 0.14); tone(990, 0.18, 'sine', 0.14, 0.09); },
    alert() { tone(220, 0.4, 'sawtooth', 0.10, 0, 440); tone(233, 0.4, 'sawtooth', 0.08, 0.02, 466); },
    cameraAlarm() { tone(880, 0.15, 'square', 0.07); tone(880, 0.15, 'square', 0.07, 0.2); },
    caught() { tone(160, 0.5, 'sawtooth', 0.14, 0, 60); noiseBurst(0.3, 0.12, 400); },
    exitOpen() { tone(523, 0.15, 'sine', 0.12); tone(784, 0.25, 'sine', 0.12, 0.12); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'sine', 0.13, i * 0.14)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.18)); },

    // A quiet low drone under the game; starts on first user gesture.
    startAmbience() {
      const c = ensure();
      if (!c || hum || muted) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      g.gain.value = 0.02;
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.008;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(c.destination);
      osc.start();
      lfo.start();
      hum = { osc, lfo };
    },
  };
}
