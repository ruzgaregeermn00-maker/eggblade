'use strict';
/* ==========================================================================
   EGGRIFT — audio.js
   Every sound is synthesised at runtime; the build ships no audio files, so
   nothing here can 404 on GitHub Pages.
   ========================================================================== */

const Sfx = (() => {
  let ctx = null, bus = null, noiseBuf = null, ready = false, muted = false;

  function init(){
    if(ctx) return ready;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 9; comp.release.value = .22;
      bus = ctx.createGain();
      bus.gain.value = .5;
      bus.connect(comp);
      comp.connect(ctx.destination);

      const n = Math.floor(ctx.sampleRate * .9);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      ready = true;
    }catch(e){ ready = false; }
    return ready;
  }
  function resume(){
    if(!ctx && !init()) return;
    if(ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function setMuted(m){
    muted = m;
    if(ready) bus.gain.setTargetAtTime(m ? 0 : .5, ctx.currentTime, .02);
  }

  function tone(t0, dur, type, f0, f1, gain, detune){
    if(!ready || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if(detune) o.detune.value = detune;
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(.015, dur * .3));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(bus);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(t0, dur, type, f0, f1, q, gain){
    if(!ready || muted) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = .8 + Math.random() * .4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * .08);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t0); s.stop(t0 + dur + .02);
  }
  const now = () => ctx ? ctx.currentTime : 0;

  return {
    init, resume, setMuted,
    get muted(){ return muted; },

    jump(){ tone(now(), .16, 'square', 300, 620, .12); },
    land(){ noise(now(), .09, 'lowpass', 900, 200, 1, .12); },
    slash(){
      const t = now();
      noise(t, .13, 'bandpass', 1400, 4200, 5, .16);
      tone(t, .1, 'sawtooth', 480, 1300, .05);
    },
    hitEnemy(){
      const t = now();
      tone(t, .1, 'square', 520, 240, .13);
      noise(t, .09, 'highpass', 1800, 700, 1.2, .12);
    },
    kill(){
      const t = now();
      tone(t, .26, 'triangle', 420, 120, .14);
      noise(t, .3, 'lowpass', 1600, 180, 1, .16);
    },
    hurt(){
      const t = now();
      tone(t, .3, 'sawtooth', 300, 70, .18);
      noise(t, .2, 'bandpass', 640, 160, 2.2, .1);
    },
    shift(dim){
      const t = now();
      /* Rising into the future, falling back into the past. */
      const a = dim === DIM_FUTURE ? 260 : 720, b = dim === DIM_FUTURE ? 900 : 240;
      tone(t, .3, 'triangle', a, b, .16);
      tone(t + .02, .26, 'sine', a * 1.5, b * 1.5, .08, 8);
      noise(t, .22, 'bandpass', 1200, 3600, 4, .1);
    },
    shiftBlocked(){
      const t = now();
      tone(t, .14, 'square', 180, 90, .14);
      noise(t, .12, 'lowpass', 500, 160, 1, .1);
    },
    laser(){
      const t = now();
      tone(t, .18, 'sawtooth', 900, 300, .07);
      noise(t, .16, 'highpass', 2400, 1200, 2, .06);
    },
    bossSlam(){
      const t = now();
      tone(t, .5, 'sine', 130, 32, .4);
      noise(t, .42, 'lowpass', 1400, 90, 1, .3);
    },
    bossRoar(){
      const t = now();
      [110, 138, 165].forEach((f, i) => tone(t + i * .04, .7, 'sawtooth', f, f * .82, .12));
      noise(t, .8, 'lowpass', 900, 140, .9, .16);
    },
    pickup(){
      const t = now();
      [523.25, 659.25, 880].forEach((f, i) => tone(t + i * .06, .3, 'triangle', f, f, .11));
    },
    checkpoint(){
      const t = now();
      [392, 523.25, 659.25, 784].forEach((f, i) => tone(t + i * .07, .4, 'sine', f, f, .1));
    },
    win(){
      const t = now();
      [523.25, 659.25, 784, 1046.5].forEach((f, i) => {
        tone(t + i * .13, .6, 'triangle', f, f, .13);
        tone(t + i * .13, .6, 'sine', f / 2, f / 2, .09);
      });
    },
    die(){
      const t = now();
      [392, 349.23, 293.66, 220].forEach((f, i) => tone(t + i * .15, .5, 'sawtooth', f, f * .97, .12));
    },
    ui(){ tone(now(), .07, 'square', 620, 820, .07); }
  };
})();
