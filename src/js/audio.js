'use strict';
/* 効果音とBGMをWebAudioで合成する(音声ファイルは使わない)。最初のタップ/クリックの後に鳴り始める */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let noiseBuf = null;
  let muted = false;
  let bgmOn = false;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let bgmMode = 'normal';
  try { muted = localStorage.getItem('harisen_mute') === '1'; } catch (e) { /* 保存できなくても遊べる */ }

  function init() {
    if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') { try { ctx.resume().catch(() => {}); } catch (e) { /* 無視 */ } } return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.14;
      bgmGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }

  function tone(freq, dur, type, vol, slideTo, delay, dest) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, freq, type, delay, q) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 1200;
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  const sfx = {
    // ハリセンを振る「ブン」
    swing(big) { noise(big ? 0.16 : 0.1, big ? 0.09 : 0.06, big ? 900 : 1600, 'bandpass', 0, 1.2); tone(big ? 180 : 260, 0.08, 'sine', 0.03, big ? 90 : 140); },
    // 当たった「スパーン!」: 紙のはじける音 + 乾いたパン
    slap(combo, big) {
      const k = Math.pow(1.04, Math.min(combo || 0, 12));
      noise(0.05, 0.3, 3200, 'highpass'); noise(0.12, 0.22, big ? 700 : 1500, 'bandpass', 0, 0.8);
      tone((big ? 520 : 760) * k, 0.07, 'square', 0.08, 180); tone(140, 0.09, 'sine', 0.16, 50);
      if (big) { tone(70, 0.22, 'sine', 0.25, 30); noise(0.25, 0.14, 400, 'lowpass'); }
    },
    zap() { for (let i = 0; i < 5; i++) tone(1800 + i * 400 * (i % 2 ? 1 : -0.5), 0.05, 'square', 0.04, 600, i * 0.03); noise(0.14, 0.1, 5000, 'highpass'); },
    // 真面目な人を叩いてしまった「ぶぶー」
    wrong() { tone(220, 0.3, 'sawtooth', 0.09, 160); tone(165, 0.42, 'square', 0.06, 110, 0.05); },
    ouch() { tone(900, 0.1, 'triangle', 0.08, 1300); tone(600, 0.14, 'triangle', 0.06, 400, 0.08); },
    // 改心のジングル
    reform() { [659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, null, i * 0.08)); tone(1568, 0.5, 'sine', 0.07, null, 0.34); noise(0.3, 0.05, 6000, 'highpass', 0.3); },
    relapse() { tone(300, 0.25, 'sawtooth', 0.06, 180); tone(240, 0.3, 'square', 0.04, 150, 0.12); },
    hurt() { tone(220, 0.28, 'sawtooth', 0.12, 70); noise(0.2, 0.1, 800, 'lowpass'); },
    pickup() { [880, 1175, 1760].forEach((f, i) => tone(f, 0.12, 'square', 0.05, null, i * 0.06)); [1047, 1319, 2093].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, null, 0.18 + i * 0.05)); },
    wornOut() { [784, 659, 523].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, null, i * 0.12)); },
    bossAppear() { noise(0.9, 0.16, 400, 'lowpass'); tone(80, 1.1, 'sawtooth', 0.13, 45); [196, 185, 175, 165].forEach((f, i) => tone(f, 0.5, 'square', 0.06, null, i * 0.25)); },
    // おばさんの「キーッ!」ガミガミ
    yell() { tone(900, 0.35, 'sawtooth', 0.09, 1400); tone(1200, 0.3, 'square', 0.05, 1900, 0.08); noise(0.35, 0.12, 2200, 'bandpass', 0, 0.6); },
    shout() { noise(0.45, 0.18, 600, 'lowpass'); tone(110, 0.45, 'sawtooth', 0.14, 60); tone(1600, 0.25, 'square', 0.05, 2400, 0.03); },
    bossHit(combo) { noise(0.06, 0.3, 2800, 'highpass'); noise(0.16, 0.22, 900, 'bandpass', 0, 0.7); tone(420 * Math.pow(1.03, Math.min(combo || 0, 12)), 0.1, 'square', 0.08, 150); tone(90, 0.2, 'sine', 0.22, 40); },
    bossStun() { for (let i = 0; i < 4; i++) tone(600 - i * 90, 0.18, 'triangle', 0.07, null, i * 0.14); },
    bossDown() { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.35, 'triangle', 0.1, null, i * 0.09); tone(f * 2, 0.3, 'sine', 0.05, null, i * 0.09); }); noise(0.6, 0.12, 1200, 'lowpass'); tone(50, 0.8, 'sine', 0.25, 30); },
    throwIt() { noise(0.12, 0.08, 1400, 'bandpass'); tone(300, 0.18, 'sine', 0.06, 700); },
    splat() { noise(0.14, 0.12, 900, 'lowpass'); tone(160, 0.12, 'sine', 0.1, 60); },
    start() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, null, i * 0.09)); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.25, 'triangle', 0.1, null, i * 0.08); }); tone(1568, 0.6, 'sine', 0.07, null, 0.45); },
    over() { [523, 440, 349, 262].forEach((f, i) => tone(f, 0.28, 'triangle', 0.12, null, i * 0.2)); },
    click() { tone(700, 0.06, 'square', 0.04); },
    gauge() { tone(1046, 0.08, 'sine', 0.06, 1568); },
    dizzy() { for (let i = 0; i < 3; i++) tone(700 + i * 100, 0.1, 'sine', 0.04, 500, i * 0.1); },
  };

  // ---- BGM: 工場っぽい、きざむリズムのループ ----
  const MEL = [0, -1, 7, -1, 4, -1, 7, 9, -1, 7, -1, 4, 2, -1, 4, -1, 0, -1, 7, -1, 4, -1, 7, 11, -1, 9, -1, 7, 4, -1, 2, -1];
  const MEL2 = [0, -1, 3, -1, 5, 6, -1, 5, -1, 3, -1, 0, -1, 3, 5, -1, 0, -1, 3, -1, 5, 6, -1, 8, -1, 6, -1, 5, 3, -1, 0, -1];
  const BASS = [0, -5, -7, -5];
  const BASE = 523.25;
  const hz = (semi, oct) => BASE * Math.pow(2, semi / 12 + (oct || 0));
  function tone2(freq, dur, type, vol, t) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(bgmGain); s.start(t); s.stop(t + 0.08);
  }
  function bgmStep(t, i) {
    const boss = bgmMode === 'boss';
    const mel = boss ? MEL2 : MEL;
    const m = mel[i % mel.length];
    if (m >= 0) tone2(hz(m) * (boss ? 0.5 : 1), 0.22, boss ? 'sawtooth' : 'square', boss ? 0.35 : 0.3, t);
    if (i % 2 === 0) tone2(hz(BASS[Math.floor((i % 32) / 8)] + (boss ? -3 : 0), -2), 0.3, 'triangle', 0.9, t);
    if (i % 4 === 0) tone2(60, 0.12, 'sine', 1.4, t); // キック
    if (i % 4 === 2) hat(t, 0.5); else hat(t, 0.18);
  }
  function startBgm(mode) {
    if (!ctx) return;
    bgmMode = mode || 'normal';
    if (bgmOn) return;
    bgmOn = true; step = 0; nextTime = ctx.currentTime + 0.1;
    const dur = () => (bgmMode === 'boss' ? 0.14 : 0.16);
    timer = setInterval(() => {
      if (!ctx || muted) { nextTime = ctx ? ctx.currentTime + 0.1 : 0; return; }
      while (nextTime < ctx.currentTime + 0.25) { bgmStep(nextTime, step++); nextTime += dur(); }
    }, 90);
  }
  function stopBgm() { bgmOn = false; if (timer) clearInterval(timer); timer = null; }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('harisen_mute', m ? '1' : '0'); } catch (e) { /* 無視 */ }
    if (master) master.gain.value = m ? 0 : 0.55;
  }
  return { init, sfx, startBgm, stopBgm, setMuted, isMuted: () => muted, setBgmMode: (m) => { bgmMode = m; } };
})();
