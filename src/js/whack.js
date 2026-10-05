'use strict';
/* おばさんたたき: モグラたたきのパロディ。工場のラインの後ろ・天井のハッチ・段ボール・画面のはしから
   いろんな出方で おばさんが出てくるので、ハリセンで連打して「ごめんなさい」と言わせる。
   叩いてはいけないものは出ない。60秒。さいごに、あやまらせた人をぜんぶ画面いっぱいに並べる */

const Whack = (() => {
  const C = {
    time: 60,
    // 5種類: hp = あやまるまでに必要な回数。size は大きさ、mean は目つきの悪さ
    types: [
      { id: 'choi', name: 'ちょいワルおばさん', hp: 3, score: 100, size: 0.9, mean: 0.55, apron: '#6a9ad0', mask: '#eef4fb', lashes: false, wrinkles: false, bags: false, stay: [1.7, 2.4], band: [10, 5, 3], taunt: ['ふんっ', 'べーっだ', 'おそいわよ〜'] },
      { id: 'iji', name: 'イジワルおばさん', hp: 5, score: 200, size: 1.0, mean: 0.8, apron: '#7a3a9a', mask: '#ffe4ec', stay: [1.9, 2.6], band: [5, 7, 5], taunt: ['にげた〜', 'あたらないわよ', 'ざんねんでした'] },
      { id: 'doiji', name: 'ドイジワルおばさん', hp: 7, score: 350, size: 1.1, mean: 0.95, apron: '#c2503a', mask: '#ffd0dc', vein: true, stay: [2.1, 2.9], band: [1, 4, 6], dodge: true, taunt: ['へたくそ〜', 'おほほほ', 'もう帰るわ'] },
      { id: 'otsubone', name: 'お局さま', hp: 10, score: 600, size: 1.3, mean: 1, apron: '#b03a8a', mask: '#f6c6ff', badge: '#ff3b7a', bloodshot: true, stay: [2.4, 3.2], band: [0, 2, 4], taunt: ['なまぬるいわね', 'その程度?', 'ふふん'] },
      { id: 'daimaou', name: '大魔王おばさま', hp: 22, score: 2000, size: 2.0, mean: 1, apron: '#2a1a3a', mask: '#e8c8ff', hood: '#f3ecff', hoodSh: '#cdbde6', badge: '#ffd24d', bloodshot: true, vein: true, stay: [6.5, 6.5], boss: true, taunt: ['また来るわよ…', 'おぼえてなさい!'] },
    ],
    bossAt: [21, 44],
    styles: { up: 40, peek: 12, down: 14, side: 12, box: 10, poof: 12 },
  };
  const OUCH = ['いたい!', 'いたっ!', 'やめて〜!', 'ひぃっ!', 'キーッ!', 'なにすんのよ!', 'いたたた!', 'ぎゃっ', 'あいたっ!', 'うぎゃ!'];
  const OUCH_BOSS = ['ぐぬぬ…!', 'なまいきな!', 'キーーッ!', 'こ、このっ!', 'いたいじゃないの!!'];
  const SORRY = ['ごめんなさい!!', 'もう しません!', 'はんせい します…', 'すみませんでした!', 'ゆるして〜!', 'わるかったわ…'];
  const SLAP = ['スパーン!!', 'バシッ!!', 'パァン!!', 'ピシャッ!', 'ズバッ!!', 'スパァン!', 'バチーン!!'];
  const rr = (a, b) => a + Math.random() * (b - a);
  const rpk = (a) => a[Math.floor(Math.random() * a.length)];
  const FONT = () => Render.FONT;

  const S = { phase: 'off', paused: false };  // off | intro | play | over | result
  let LW = 1280; let LH = 720; let sc = 1;       // 論理サイズと 1論理px あたりの CSS px
  let spots = [];      // 出てくる場所
  let moles = [];      // いま出ているおばさん
  let fx = [];         // 文字・星・ハリセン
  let hud = null;

  // ---------- 配置(画面の形に合わせる) ----------
  function layout() {
    const V = G.view;
    const portrait = V.W < V.H;
    LW = portrait ? 760 : 1280; sc = V.W / LW; LH = V.H / sc;
    const beltTop = Math.round(LH * (portrait ? 0.64 : 0.66));
    // 天井のハッチは、上の表示(時間・スコア)に かくれない高さに
    const ceil = Math.max(60, Math.min(190, Math.round((portrait ? 150 : 96) / sc)));
    const L = { portrait, beltTop, beltH: 74, ceil, floorY: beltTop + 74, charScale: portrait ? 1.05 : 1.25 };
    spots = [];
    const nUp = portrait ? 3 : 5;
    for (let i = 0; i < nUp; i++) spots.push({ style: 'up', x: LW * ((i + 0.5) / nUp), y: beltTop + 6, busy: null });
    const nDown = portrait ? 2 : 3;
    for (let i = 0; i < nDown; i++) spots.push({ style: 'down', x: LW * ((i + 0.5) / nDown) + (portrait ? 0 : 60), y: L.ceil, busy: null });
    spots.push({ style: 'left', x: 0, y: beltTop - 10, busy: null });
    spots.push({ style: 'right', x: LW, y: beltTop - 10, busy: null });
    spots.push({ style: 'box', x: LW * 0.18, y: L.floorY + 92, busy: null, boxW: 150 });
    spots.push({ style: 'box', x: LW * 0.82, y: L.floorY + 92, busy: null, boxW: 150 });
    for (let i = 0; i < (portrait ? 2 : 3); i++) spots.push({ style: 'poof', x: LW * ((i + 0.5) / (portrait ? 2 : 3)), y: beltTop - 150, busy: null });
    S.L = L;
  }

  // ---------- 開始・終了 ----------
  function start() {
    Sound.init(); Sound.setBgmMode('villain'); Sound.stopBgm(); Sound.startBgm('villain');
    layout();
    moles = []; fx = [];
    Object.assign(S, { phase: 'intro', paused: false, t: 0, timeLeft: C.time, score: 0, dispScore: 0, combo: 0, comboT: 0, bestCombo: 0, hits: 0, misses: 0, sorry: [], escaped: 0, spawnT: 0.6, bossDone: [], shake: 0, hitStop: 0, flash: 0, resultT: 0, lastTap: 0, wave: 0 });
    hud = { time: $('wTime'), score: $('wScore'), combo: $('wCombo'), count: $('wCount') };
    $('whackHud').classList.remove('hidden');
    $('whackResult').classList.add('hidden');
    UI.banner('おばさんたたき!');
  }
  function stop() { S.phase = 'off'; moles = []; fx = []; $('whackHud').classList.add('hidden'); $('whackResult').classList.add('hidden'); }

  // ---------- 出てくる ----------
  function pickType(p) {
    const band = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
    const cands = C.types.filter((t) => !t.boss);
    let total = 0; for (const t of cands) total += t.band[band];
    let r = Math.random() * total;
    for (const t of cands) { r -= t.band[band]; if (r <= 0) return t; }
    return cands[0];
  }
  function pickStyle() {
    let total = 0; for (const k in C.styles) total += C.styles[k];
    let r = Math.random() * total;
    for (const k in C.styles) { r -= C.styles[k]; if (r <= 0) return k; }
    return 'up';
  }
  function spawn(type, style) {
    const want = style === 'side' ? (Math.random() < 0.5 ? 'left' : 'right') : style === 'peek' ? 'up' : style;
    const free = spots.filter((s) => s.style === want && !s.busy);
    if (!free.length) return null;
    const spot = rpk(free);
    const p = 1 - S.timeLeft / C.time;
    const stay = rr(type.stay[0], type.stay[1]) * (type.boss ? 1 : 1 - p * 0.3);
    const m = { type, style, spot, x: spot.x, y: spot.y, t: 0, phase: 'in', rise: 0, hp: type.hp, hits: 0, stay, inDur: style === 'poof' ? 0.18 : type.boss ? 0.7 : 0.32, outDur: 0.35, face: spot.style === 'right' ? -1 : spot.style === 'left' ? 1 : Math.random() < 0.5 ? 1 : -1, hitT: 0, speech: null, wob: 0, wobV: 0, dodgeT: rr(0.8, 1.6), dx: 0, sorry: false, scale: S.L.charScale * type.size, peek: style === 'peek' };
    if (style === 'down') m.face = Math.random() < 0.5 ? 1 : -1;
    spot.busy = m;
    moles.push(m);
    if (type.boss) { Sound.sfx.bigPop(); UI.banner(type.name + ' 登場!!'); S.shake = 14; }
    else if (style === 'poof') Sound.sfx.poof(); else if (style === 'peek') Sound.sfx.peek(); else Sound.sfx.pop();
    return m;
  }
  function spawnBoss() {
    const t = C.types[4];
    const spot = spots.filter((s) => s.style === 'up')[Math.floor(spots.filter((s) => s.style === 'up').length / 2)];
    if (spot.busy) { spot.busy.phase = 'out'; spot.busy.t = 0; spot.busy = null; }
    const m = spawn(t, 'up');
    if (m) { m.speech = { text: rpk(['わたしの ラインで なにしてるの!!', 'ぜんいん クビよ!!', 'だれが お局ですって!?']), t: 0, dur: 2.2, style: 'shout' }; }
  }

  // おばさんの いまの位置(頭の中心)と 当たり判定
  function headR(m) { return 44 * 1.15 * m.scale; }
  function bodyH(m) { return 150 * m.scale; }
  function pose(m) {
    const L = S.L; const H = bodyH(m); const R = headR(m);
    const e = m.phase === 'in' ? easeOutBack(m.rise) : m.rise;
    const target = m.peek ? 0.36 : 1;
    const k = e * target;
    let x = m.x + m.dx; let y; let rot = 0; let clip = null; let feetY;
    switch (m.spot.style) {
      case 'up': feetY = m.y + 10 + (1 - k) * H; x = m.x + m.dx; y = feetY; clip = { x: -9999, y: -9999, w: 99999, h: L.beltTop + 9999 - (-9999) - 0 }; clip = { x: -5000, y: -5000, w: 10000, h: 5000 + L.beltTop + 4 }; break;
      case 'down': rot = Math.PI; feetY = m.y - 8 - (1 - k) * H; y = feetY; clip = { x: -5000, y: L.ceil - 2, w: 10000, h: 10000 }; break;
      case 'left': feetY = m.y; y = feetY; x = -R * 1.4 + k * (R * 1.4 + 70 * m.scale + 50); clip = { x: 0, y: -5000, w: 10000, h: 10000 }; break;
      case 'right': feetY = m.y; y = feetY; x = LW + R * 1.4 - k * (R * 1.4 + 70 * m.scale + 50); clip = { x: -10000, y: -5000, w: 10000 + LW, h: 10000 }; break;
      case 'box': feetY = m.y + (1 - k) * H; y = feetY; clip = { x: -5000, y: -5000, w: 10000, h: 5000 + m.y - 60 }; break;
      case 'poof': feetY = m.y + 60; y = feetY; break;
      default: feetY = m.y; y = feetY;
    }
    // 頭の中心(回転も考える)
    const headOff = (40 + R * 0.75) * 1.15 * m.scale;
    const hx = x; const hy = rot ? y + headOff : y - headOff;
    return { x, y, rot, clip, hx, hy, R, k, scale: m.scale * (m.spot.style === 'poof' ? Math.min(1, e) : 1) };
  }
  function easeOutBack(t) { const c = 1.9; t = Math.min(1, Math.max(0, t)); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function hitTest(m, px, py) {
    if (m.phase === 'gone' || m.rise < 0.25) return false;
    const q = pose(m);
    if (q.clip && (px < q.clip.x || px > q.clip.x + q.clip.w || py < q.clip.y || py > q.clip.y + q.clip.h)) return false;
    const R = q.R * 1.35;
    if (Math.hypot(px - q.hx, py - q.hy) < R) return true;
    // からだ
    const top = q.rot ? q.y : q.y - bodyH(m) * 0.6; const bot = q.rot ? q.y + bodyH(m) * 0.6 : q.y;
    return Math.abs(px - q.x) < 40 * m.scale && py > top - 10 && py < bot + 10;
  }

  // ---------- たたく ----------
  function tap(cx, cy) {
    if (S.phase === 'off') return false;
    if (S.paused) return true;
    if (S.phase !== 'play') return true;
    const px = cx / sc; const py = cy / sc;
    S.lastTap = S.t;
    // 手前(あとに描く)から順に
    let target = null; let bonus = null;
    for (let i = moles.length - 1; i >= 0; i--) { if (hitTest(moles[i], px, py)) { if (moles[i].sorry) { if (!bonus) bonus = moles[i]; continue; } target = moles[i]; break; } }
    fx.push({ kind: 'swing', x: px, y: py, t: 0, dir: Math.random() < 0.5 ? 1 : -1, hit: !!(target || bonus) });
    if (!target && bonus) {
      // あやまっている人への 追い打ち: ちょっとだけ おまけ
      S.score += 5; S.hits++; bonus.hitT = 0.15; bonus.wobV += (px < bonus.x ? 1 : -1) * 6;
      fx.push({ kind: 'text', x: px, y: py - 30, text: rpk(['おまけ +5', 'ペシッ', 'もういいって〜']), color: '#c8b0ff', size: 20, t: 0, life: 0.5, vy: -40, rot: rr(-0.2, 0.2) });
      Sound.sfx.whiff();
      return true;
    }
    if (!target) {
      S.misses++; S.combo = 0;
      fx.push({ kind: 'text', x: px, y: py - 30, text: 'スカッ', color: '#9aa6b8', size: 20, t: 0, life: 0.5, vy: -40, rot: rr(-0.2, 0.2) });
      Sound.sfx.whiff();
      return true;
    }
    hit(target, px, py);
    return true;
  }
  function hit(m, px, py) {
    const big = m.type.boss;
    S.hits++; S.combo++; S.comboT = 1.6; S.bestCombo = Math.max(S.bestCombo, S.combo);
    const mult = Math.min(1 + Math.floor(S.combo / 5) * 0.5, 4);
    S.score += Math.round(10 * mult * (m.type.boss ? 2 : 1));
    m.hp--; m.hits++; m.hitT = 0.22; m.wobV += (px < m.x ? 1 : -1) * 9; m.face = px < m.x ? -1 : 1;
    if (m.phase === 'in' && m.rise < 0.6) m.rise = 0.6;
    const q = pose(m);
    fx.push({ kind: 'text', x: px + rr(-10, 10), y: py - 40, text: rpk(SLAP), color: '#fff', size: big ? 40 : 32, t: 0, life: 0.55, vy: -60, rot: rr(-0.25, 0.25) });
    fx.push({ kind: 'impact', x: px, y: py, t: 0, big });
    for (let i = 0; i < (big ? 10 : 6); i++) fx.push({ kind: 'star', x: px, y: py, vx: rr(-260, 260), vy: rr(-320, -40), t: 0, life: rr(0.4, 0.8), size: rr(5, 10), color: rpk(['#ffe14d', '#fff', '#ff9a5c']) });
    m.speech = { text: rpk(big ? OUCH_BOSS : OUCH), t: 0, dur: 0.7, style: big ? 'shout' : 'talk' };
    S.shake = Math.max(S.shake, big ? 9 : 5); if (S.hitStop <= 0) S.hitStop = 0.025;
    Sound.sfx.slap(S.combo, big); Sound.sfx.ouchy(S.combo);
    if (S.combo > 0 && S.combo % 10 === 0) fx.push({ kind: 'text', x: LW / 2, y: LH * 0.3, text: S.combo + ' れんぱつ!!', color: '#ffd24d', size: 44, t: 0, life: 1, vy: -30, rot: 0 });
    if (m.hp <= 0) apologize(m, q);
  }
  function apologize(m, q) {
    const big = m.type.boss;
    const mult = Math.min(1 + Math.floor(S.combo / 5) * 0.5, 4);
    const pts = Math.round(m.type.score * mult * (m.peek ? 1.5 : 1));
    S.score += pts;
    S.sorry.push({ type: m.type, style: m.spot.style, peek: m.peek });
    m.sorry = true; m.phase = 'out'; m.t = 0; m.outDur = big ? 1.6 : 0.8;
    m.speech = { text: rpk(SORRY), t: 0, dur: 1.4, style: 'talk' };
    fx.push({ kind: 'text', x: q.hx, y: q.hy - q.R - 30, text: big ? '大魔王も ごめんなさい!!' : 'ごめんなさい!', color: '#ffd24d', size: big ? 46 : 34, t: 0, life: 1.1, vy: -50, rot: 0 });
    fx.push({ kind: 'text', x: q.hx + 40, y: q.hy, text: '+' + pts, color: '#fff', size: 24, t: 0, life: 1, vy: -40, rot: 0 });
    if (m.peek) fx.push({ kind: 'text', x: q.hx, y: q.hy + 30, text: 'ちょこっと見つけた! ×1.5', color: '#8fd37a', size: 20, t: 0, life: 1, vy: -30, rot: 0 });
    for (let i = 0; i < (big ? 40 : 14); i++) fx.push({ kind: 'star', x: q.hx, y: q.hy, vx: rr(-320, 320), vy: rr(-420, -60), t: 0, life: rr(0.6, 1.3), size: rr(6, 14), color: rpk(['#ffd24d', '#ff7aa8', '#8fd37a', '#5ab0ff', '#fff']) });
    if (big) { Sound.sfx.bossDown(); S.shake = 18; S.hitStop = 0.18; S.flash = 1; UI.banner('大魔王に ごめんなさいを 言わせた!!'); } else Sound.sfx.sorry();
  }

  // ---------- 進行 ----------
  function update(real) {
    if (S.phase === 'off' || S.paused) return;
    let dt = real;
    if (S.hitStop > 0) { S.hitStop -= real; dt = real * 0.15; } // 当たった瞬間だけ 絵をぐっと遅く(時計は止めない)
    S.t += real;
    S.shake = Math.max(0, S.shake - real * 40); S.flash = Math.max(0, S.flash - real * 2);
    if (S.phase === 'intro') { if (S.t > 1.2) { S.phase = 'play'; S.t = 0; UI.banner('はじめ!'); Sound.sfx.countdown(true); } }
    else if (S.phase === 'play') {
      S.timeLeft -= real;
      S.comboT -= real; if (S.comboT <= 0 && S.combo > 0) S.combo = 0;
      if (S.timeLeft <= 0) { S.timeLeft = 0; S.phase = 'over'; S.t = 0; UI.banner('おわり!'); Sound.sfx.whistle(); Sound.stopBgm(); for (const m of moles) if (m.phase !== 'out') { m.phase = 'out'; m.t = 0; } }
      const p = 1 - S.timeLeft / C.time;
      const maxActive = 1 + Math.floor(p * 3.4);
      S.spawnT -= real;
      const active = moles.filter((m) => m.phase !== 'gone' && !m.type.boss).length;
      if (S.spawnT <= 0 && active < maxActive) {
        S.spawnT = (1.15 - p * 0.7) * rr(0.6, 1.1);
        spawn(pickType(p), pickStyle());
      }
      for (const b of C.bossAt) { const e = C.time - S.timeLeft; if (e >= b && !S.bossDone.includes(b)) { S.bossDone.push(b); spawnBoss(); } }
      if (S.timeLeft < 10 && Math.floor(S.timeLeft) !== Math.floor(S.timeLeft + real)) Sound.sfx.countdown(false);
    } else if (S.phase === 'over') {
      if (S.t > 1.6 && moles.every((m) => m.phase === 'gone')) { S.phase = 'result'; S.t = 0; S.resultT = 0; showResult(); }
      if (S.t > 3) { moles = []; S.phase = 'result'; S.t = 0; S.resultT = 0; showResult(); }
    } else if (S.phase === 'result') { S.resultT += dt; }
    // おばさんたち
    for (const m of moles) {
      m.t += dt; m.hitT = Math.max(0, m.hitT - dt);
      if (m.speech) { m.speech.t += dt; if (m.speech.t > m.speech.dur) m.speech = null; }
      m.wobV -= m.wob * 60 * dt; m.wobV *= Math.exp(-5 * dt); m.wob += m.wobV * dt;
      if (m.phase === 'in') { m.rise = Math.min(1, m.rise + dt / m.inDur); if (m.rise >= 1) { m.phase = 'stay'; m.t = 0; } }
      else if (m.phase === 'stay') {
        if (m.type.dodge && m.spot.style === 'up') { m.dodgeT -= dt; if (m.dodgeT <= 0) { m.dodgeT = rr(0.7, 1.4); m.dxTarget = rr(-70, 70); } m.dx += ((m.dxTarget || 0) - m.dx) * Math.min(1, dt * 6); }
        if (m.type.boss && m.spot.style === 'up') { m.dx = Math.sin(m.t * 1.3) * 120; }
        if (m.t >= m.stay) { m.phase = 'out'; m.t = 0; S.escaped++; m.speech = { text: rpk(m.type.taunt), t: 0, dur: 0.8, style: 'talk' }; }
      } else if (m.phase === 'out') { m.rise = Math.max(0, m.rise - dt / m.outDur); if (m.rise <= 0) { m.phase = 'gone'; if (m.spot.busy === m) m.spot.busy = null; } }
    }
    moles = moles.filter((m) => m.phase !== 'gone');
    for (const f of fx) { f.t += dt; if (f.kind === 'star') { f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } if (f.kind === 'text') { f.y += f.vy * dt; } }
    fx = fx.filter((f) => f.t < (f.life || (f.kind === 'swing' ? 0.18 : f.kind === 'impact' ? 0.2 : 0.6)));
  }

  // ---------- 描画 ----------
  function draw(t) {
    const ctx = G.ctx; const V = G.view; const L = S.L;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a2436'; ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
    ctx.setTransform(sc * V.dpr, 0, 0, sc * V.dpr, 0, 0);
    const shx = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0; const shy = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    ctx.translate(shx, shy);
    if (S.phase === 'result') { drawResult(ctx, t); return; }
    drawScene(ctx, t);
    // 奥のもの(天井から・ポン・横) → ベルトの後ろ → ベルト → 段ボールから → 手前の段ボール
    const order = (m) => ({ down: 0, poof: 1, left: 2, right: 2, up: 3, box: 5 }[m.spot.style]);
    const sorted = moles.slice().sort((a, b) => order(a) - order(b) || a.t - b.t);
    for (const m of sorted) if (order(m) <= 3) drawMole(ctx, m, t);
    drawBelt(ctx, t);
    for (const m of sorted) if (order(m) > 3) drawMole(ctx, m, t);
    drawBoxFronts(ctx);
    drawFx(ctx);
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.flash * 0.5})`; ctx.fillRect(-50, -50, LW + 100, LH + 100); }
  }
  function drawScene(ctx, t) {
    const L = S.L;
    // 壁(緑がかった工場の壁)と天井のパイプ・ハッチ
    const gr = ctx.createLinearGradient(0, 0, 0, L.beltTop); gr.addColorStop(0, '#b8c8d8'); gr.addColorStop(1, '#dde6ee');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, LW, L.beltTop);
    ctx.strokeStyle = 'rgba(80,100,130,0.18)'; ctx.lineWidth = 2; for (let x = 0; x < LW; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.beltTop); ctx.stroke(); }
    ctx.fillStyle = '#6a7486'; ctx.fillRect(0, 0, LW, L.ceil); ctx.fillStyle = '#58606f'; ctx.fillRect(0, L.ceil - 10, LW, 10);
    ctx.fillStyle = '#8a95a8'; ctx.fillRect(0, 14, LW, 18); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 16, LW, 4);
    for (const s of spots) {
      if (s.style === 'down') { Art.rrect(ctx, s.x - 70, L.ceil - 44, 140, 44, 6, '#4a5262', 3); ctx.fillStyle = '#2a2f3a'; ctx.fillRect(s.x - 62, L.ceil - 36, 124, 30); ctx.font = `800 14px ${FONT()}`; ctx.fillStyle = '#ffd24d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('点検口', s.x, L.ceil - 21); for (let x = s.x - 70; x < s.x + 70; x += 20) { ctx.fillStyle = (Math.floor(x / 20) % 2) ? '#ffcf3a' : '#2f2a3a'; ctx.fillRect(x, L.ceil - 4, 20, 6); } }
    }
    // 看板
    ctx.font = `800 ${L.portrait ? 16 : 20}px ${FONT()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText('おばさん たたき 専用ライン').width + 28;
    Art.rrect(ctx, LW / 2 - w / 2, L.ceil + 14, w, 34, 6, '#fff', 2.6, '#2a7ad0'); ctx.fillStyle = '#2a7ad0'; ctx.fillText('おばさん たたき 専用ライン', LW / 2, L.ceil + 31);
    // 床
    ctx.fillStyle = '#e9edf3'; ctx.fillRect(0, L.floorY, LW, LH - L.floorY);
    ctx.strokeStyle = 'rgba(150,165,190,0.5)'; ctx.lineWidth = 2; for (let x = 0; x < LW; x += 80) { ctx.beginPath(); ctx.moveTo(x, L.floorY); ctx.lineTo(x, LH); ctx.stroke(); } for (let y = L.floorY + 80; y < LH; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,200,40,0.6)'; ctx.lineWidth = 6; ctx.setLineDash([30, 18]); ctx.beginPath(); ctx.moveTo(0, L.floorY + 60); ctx.lineTo(LW, L.floorY + 60); ctx.stroke(); ctx.setLineDash([]);
    // ポンと出る場所の けむり台(なにもない。急に出る)
  }
  function drawBelt(ctx, t) {
    const L = S.L; const Sp = Art.S;
    Art.rrect(ctx, -10, L.beltTop - 6, LW + 20, L.beltH + 12, 8, '#8e9bb0', 3);
    ctx.fillStyle = '#3a3f4c'; ctx.fillRect(-10, L.beltTop, LW + 20, L.beltH);
    const off = (t * 90) % 40;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = off - 40; x < LW + 40; x += 40) { ctx.moveTo(x, L.beltTop + 4); ctx.lineTo(x - 6, L.beltTop + L.beltH - 4); } ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-10, L.beltTop, LW + 20, 6);
    const period = 76; const shift = (t * 90) % period;
    for (let x = shift - period; x < LW + 40; x += period) { const k = Math.floor((x - shift) / period); if ((k * 7919) % 4 === 0) continue; Art.blit(ctx, k % 2 ? Sp.cabbageSmall : Sp.hakusaiSmall, x, L.beltTop + L.beltH / 2 + Math.sin(k * 1.7) * 6, 1.15); }
    // 作業台のかわりに、たたき台の目印
    for (const s of spots) if (s.style === 'up') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(s.x, L.beltTop + L.beltH / 2, 60, 14, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawBoxFronts(ctx) {
    for (const s of spots) {
      if (s.style !== 'box') continue;
      const w = s.boxW; const h = 96; const x = s.x - w / 2; const y = s.y - h;
      Art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#d9a86a', 2.6);
      ctx.fillStyle = '#9b6a3a'; ctx.fillRect(x, y + h * 0.45, w, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 18, y + 20, 48, 16); ctx.fillRect(x + w - 50, y + 20, 32, 16);
      ctx.font = `800 13px ${FONT()}`; ctx.fillStyle = '#5a3f22'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('キャベツ', x + 20, y + 28);
      // ふた(開いている)
      const open = s.busy ? Math.min(1, s.busy.rise * 1.4) : 0;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-open * 1.9); Art.poly(ctx, [0, 0, w * 0.52, 0, w * 0.52, -10, 0, -10], '#e9c389', 2.2); ctx.restore();
      ctx.save(); ctx.translate(x + w, y); ctx.rotate(open * 1.9); Art.poly(ctx, [0, 0, -w * 0.52, 0, -w * 0.52, -10, 0, -10], '#e9c389', 2.2); ctx.restore();
    }
  }
  function drawMole(ctx, m, t) {
    const q = pose(m);
    if (q.k <= 0.001 && m.spot.style !== 'poof') return;
    ctx.save();
    if (q.clip) { ctx.beginPath(); ctx.rect(q.clip.x, q.clip.y, q.clip.w, q.clip.h); ctx.clip(); }
    if (m.spot.style === 'poof' && m.rise < 1 && m.phase !== 'stay') {
      // けむり
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + t; const rr2 = 40 * m.scale * (1 - m.rise) + 20; ctx.fillStyle = 'rgba(230,230,240,0.8)'; ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * rr2, q.y - 60 * m.scale + Math.sin(a) * rr2 * 0.6, 22 * m.scale, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot + m.wob * 0.02);
    if (m.hitT > 0) ctx.filter = 'brightness(1.6)';
    const st = m.sorry ? 'defeated' : m.hitT > 0.1 ? 'stagger' : m.hits > 0 && m.hp <= 2 && !m.type.boss ? 'stun' : 'seek';
    const B = { face: m.face, state: st, moving: false, walkT: 0, level: 1, look: { x: m.face * 0.5, y: 0.2 }, hitFlash: m.hitT, size: 1, apron: m.type.apron, mask: m.type.mask, hood: m.type.hood, hoodSh: m.type.hoodSh, badge: m.type.badge, mean: m.type.mean, lashes: m.type.lashes, wrinkles: m.type.wrinkles, bags: m.type.bags, bloodshot: m.type.bloodshot, vein: m.type.vein, toneMul: m.type.boss ? 1.2 : m.type.mean >= 0.95 ? 0.8 : 0.45, noShadow: m.spot.style !== 'poof' };
    ctx.scale(q.scale, q.scale);
    Art.drawBoss(ctx, B, t + m.t);
    ctx.filter = 'none';
    ctx.restore();
    // 名前・HP・ふきだし(回転させない)
    const R = q.R;
    const ny = q.rot ? q.hy + R + 18 : q.hy - R - 16;
    if (!m.sorry) {
      ctx.font = `800 ${Math.round(14 * Math.min(1.6, m.scale))}px ${FONT()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = Art.OUT; ctx.strokeText(m.type.name, q.hx, ny); ctx.fillStyle = m.type.boss ? '#ff8ad0' : '#fff'; ctx.fillText(m.type.name, q.hx, ny);
      const bw = Math.min(140, 50 + m.type.hp * 8); const bh = 10; const bx = q.hx - bw / 2; const by = ny + (q.rot ? 14 : -16);
      Art.rrect(ctx, bx, by, bw, bh, 5, 'rgba(47,42,58,0.8)', 2); ctx.fillStyle = m.hp <= 2 ? '#ffd24d' : '#ff5a7e'; ctx.fillRect(bx + 1, by + 1, (bw - 2) * (m.hp / m.type.hp), bh - 2);
    }
    if (m.speech) { const a = m.speech.t > m.speech.dur - 0.25 ? (m.speech.dur - m.speech.t) / 0.25 : 1; Art.drawBubble(ctx, q.hx + (q.rot ? 0 : 0), q.rot ? q.hy + R + 60 : q.hy - R - 46, m.speech.text, m.speech.style, `800 ${Math.round(20 * Math.min(1.4, m.scale))}px ${FONT()}`, a, { top: 70, left: 0, right: LW, sideX: 60 }); }
  }
  function drawFx(ctx) {
    for (const f of fx) {
      if (f.kind === 'swing') {
        const k = f.t / 0.18; ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - k * 0.6;
        ctx.rotate(f.dir * (-1.4 + k * 2.6) - Math.PI / 2); Art.drawHarisen(ctx, f.hit ? 'jumbo' : 'normal', 1.3); ctx.restore();
      } else if (f.kind === 'impact') {
        const k = f.t / 0.2; ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - k; const r = (f.big ? 50 : 34) * (0.6 + k * 0.9);
        ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const rr2 = i % 2 ? r * 0.55 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = Art.OUT; ctx.stroke(); ctx.restore();
      } else if (f.kind === 'star') { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); Art.star(ctx, f.x, f.y, f.size, f.t * 6, f.color, 0); ctx.globalAlpha = 1; }
      else if (f.kind === 'text') {
        const k = f.t / f.life; const s = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : 1.2;
        ctx.save(); ctx.translate(f.x, f.y); ctx.scale(s, s); ctx.rotate(f.rot || 0); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.font = `800 ${f.size}px ${FONT()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(4, f.size * 0.22); ctx.strokeStyle = Art.OUT; ctx.lineJoin = 'round'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
      }
    }
  }

  // ---------- けっか: あやまらせた人を 画面いっぱいに ----------
  function showResult() {
    $('whackHud').classList.add('hidden');
    const r = $('whackResult'); r.classList.remove('hidden');
    const n = S.sorry.length;
    const best = loadWhackBest();
    if (S.score > best) saveWhackBest(S.score);
    $('wrTitle').textContent = n === 0 ? 'だれにも あやまらせられなかった…' : n + '人に ごめんなさいと 言わせた!';
    $('wrScore').textContent = S.score.toLocaleString('en-US');
    $('wrSub').textContent = `ヒット ${S.hits}発 / さいだい ${S.bestCombo}れんぱつ / にがした ${S.escaped}人 / ハイスコア ${Math.max(best, S.score).toLocaleString('en-US')}`;
    S.grid = null; S.allShown = false;
    Sound.sfx.clear();
  }
  function drawResult(ctx, t) {
    const n = S.sorry.length;
    ctx.fillStyle = '#f6efe6'; ctx.fillRect(-50, -50, LW + 100, LH + 100);
    // 上の見出し(DOM)と 下のボタンの あいだに 並べる
    let top = Math.round(Math.min(170, LH * 0.24)); let bottom = LH - Math.round(Math.min(96, LH * 0.14));
    try { const a = document.querySelector('#whackResult .wr-top').getBoundingClientRect(); const b = document.querySelector('#whackResult .wr-btns').getBoundingClientRect(); top = Math.round(a.bottom / sc) + 12; bottom = Math.round(b.top / sc) - 8; } catch (e) { /* そのまま */ }
    if (n === 0) {
      ctx.save(); ctx.translate(LW / 2, LH * 0.62); ctx.scale(1.5, 1.5); Art.drawBoss(ctx, { face: 1, state: 'seek', moving: false, walkT: 0, level: 1, look: { x: 0.4, y: 0.2 }, hitFlash: 0, mean: 1, apron: '#7a3a9a' }, t); ctx.restore();
      Art.drawBubble(ctx, LW / 2, LH * 0.62 - 190, 'おほほほ! ぜんぜん あたらなかったわね', 'talk', `800 22px ${FONT()}`, 1, { top: 70, left: 0, right: LW });
      return;
    }
    if (!S.grid) {
      const area = (LW - 40) * (bottom - top);
      let cell = Math.sqrt(area / n) * 0.98; cell = Math.max(34, Math.min(150, cell));
      let cols = Math.max(1, Math.floor((LW - 40) / cell)); let rows = Math.ceil(n / cols);
      while (rows * cell > bottom - top && cell > 34) { cell *= 0.95; cols = Math.max(1, Math.floor((LW - 40) / cell)); rows = Math.ceil(n / cols); }
      S.grid = { cell, cols, rows, x0: (LW - cols * cell) / 2, y0: top + Math.max(0, (bottom - top - rows * cell) / 2) };
    }
    const g = S.grid;
    const per = Math.min(0.08, 3.2 / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const born = i * per; if (S.resultT < born) break;
      const age = S.resultT - born;
      if (age < 0.02 && age + 0.02 >= 0) Sound.sfx.sorryTiny(i);
      const e = Math.min(1, age / 0.25); const pop = 1 + (1 - e) * (1 - e) * 1.5 * (e < 1 ? 1 : 0);
      const s = S.sorry[i];
      const cx = g.x0 + (i % g.cols) * g.cell + g.cell / 2; const cy = g.y0 + Math.floor(i / g.cols) * g.cell + g.cell * 0.9;
      const k = (g.cell / 150) * Math.min(1.25, 0.95 + s.type.size * 0.12) * pop;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      // おじぎ(みんな ぺこぺこ)
      const bow = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7);
      ctx.translate(0, bow * 6); ctx.scale(1, 1 - bow * 0.1);
      Art.drawBoss(ctx, { face: i % 2 ? -1 : 1, state: 'defeated', moving: false, walkT: 0, level: 1, look: { x: 0, y: 0.5 }, hitFlash: 0, size: 1, apron: s.type.apron, mask: s.type.mask, hood: s.type.hood, hoodSh: s.type.hoodSh, badge: s.type.badge, mean: 0.15, lashes: s.type.lashes, wrinkles: s.type.wrinkles, bags: s.type.bags, toneMul: 0, noShadow: true }, t);
      ctx.restore();
      if (g.cell >= 48 && age > 0.2) {
        const txt = ['ごめんなさい', 'もうしません', 'はんせい', 'すみません', 'ゆるして'][i % 5];
        const fs = Math.max(9, Math.min(16, g.cell * 0.13));
        ctx.font = `800 ${fs}px ${FONT()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, cx, cy - g.cell * 0.86); ctx.fillStyle = '#8a3fd0'; ctx.fillText(txt, cx, cy - g.cell * 0.86);
      }
    }
    if (!S.allShown && S.resultT > n * per + 0.3) { S.allShown = true; $('wrTitle').textContent = 'みんな ごめんなさい!! (' + n + '人)'; Sound.sfx.sorry(); }
  }
  function loadWhackBest() { try { return parseInt(localStorage.getItem('harisen_whack_best') || '0', 10) || 0; } catch (e) { return 0; } }
  function saveWhackBest(v) { try { localStorage.setItem('harisen_whack_best', String(v)); } catch (e) { /* 無視 */ } }

  // ---------- HUD ----------
  function updateHud() {
    if (!hud || S.phase === 'off') return;
    const sec = Math.ceil(S.timeLeft);
    hud.time.textContent = sec; hud.time.classList.toggle('warn', sec <= 10 && S.phase === 'play');
    if (S.dispScore < S.score) S.dispScore = Math.min(S.score, S.dispScore + Math.max(5, Math.ceil((S.score - S.dispScore) * 0.25)));
    hud.score.textContent = S.dispScore.toLocaleString('en-US');
    hud.combo.textContent = S.combo >= 3 ? S.combo + ' れんぱつ' : '';
    hud.count.textContent = 'ごめんなさい ' + S.sorry.length + '人';
  }
  function resize() { if (S.phase !== 'off') { layout(); S.grid = null; for (const m of moles) { m.phase = 'gone'; } moles = []; for (const s of spots) s.busy = null; } }
  return { C, S, start, stop, update, draw, tap, updateHud, resize, moles: () => moles, spawn, spawnBoss, pickType, hit, pose };
})();
