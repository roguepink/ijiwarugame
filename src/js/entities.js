'use strict';
/* ゲームの動き: プレイヤー、ハリセンの当たり、作業員のAI(まじめ/サボり/悪口コンビ/ジャマ)、改心と再発、ボス(イジワルおばさん)、
   投げキャベツ、落ちているハリセン、パーティクル、浮かぶ文字 */

const LINES = {
  good: ['よいしょ', 'はこづめ 完了!', 'おつかれさま〜', 'がんばろ!', 'ふんふん♪', 'ていねいに ていねいに', 'つぎ おねがいします', 'いい白菜!'],
  goodHit: ['いたっ!?', 'なにするの!', 'ひどい…', 'まじめに やってるのに!', 'え…なんで…'],
  reformedHit: ['もう 改心したのに!', 'いたい! まじめに やってます!', 'ひどい…'],
  slacker: ['ふぁ〜あ…', 'だる…', 'Zzz…', 'あと5分…', 'スマホ スマホ', 'バレなきゃ OK', 'はたらきたくな〜い'],
  gossip: ['あの人 おそいよね〜', 'ねー ダサすぎ', 'クスクス', 'ヒソヒソ', 'しんじん ムカつく', 'あの人の弁当 見た?', 'ププッ', 'ありえな〜い'],
  sabo: ['じゃま〜', 'おっと 手が すべった', 'ちゃんと やれよ〜', 'どけよ', 'おまえの分も やっとけ', 'へたくそ〜'],
  minion: ['おばさまの ために!', 'じゃまじゃま〜', 'どけどけ!'],
  badHit: ['いたっ!', 'なにすんだよ!', 'やめろって!', 'ちょ、ちょっと!', 'ぐえっ'],
  reform: ['ごめんなさい!', 'まじめに やります!', '心を 入れかえます!', '反省 しました…'],
  relapse: ['…ムカムカ', 'もう つかれた…', 'やっぱ サボろ', '…またか'],
  pretend: ['しごと しごと♪', 'えっと…はい', '…', 'まじめに やってますよ〜'],
  retaliate: ['やめろよ!', 'うるさい!', 'こっちも やり返す!'],
  bossScold: ['おそい! なにやってんの!', 'ちょっと あんた!', 'ぐずぐず しないで!', 'それで 給料 もらえると\n思ってるの?', 'あんた クビよ!', 'なんど 言わせるの!!', 'つかえない 子ね!'],
  bossHit: ['なによ!', 'なまいきな!', 'キーッ!', 'いたいわね!', 'だれに 向かって!'],
  bossEnter: ['ちょっと あんたたち!!', 'サボってるの だれ!?', 'わたしの ラインで\nなにしてるの!'],
  bossDown: ['もう いじめません…', 'ごめんなさい…', 'わたしが わるかったわ…'],
  bossThrow: ['これでも 食らいなさい!', 'キャベツ よけなさいよ!'],
  bossShout: ['ガミガミガミ!!', 'いいかげんに しなさい!!', 'キーーーッ!!'],
  cry: ['うぅ…', 'ごめんなさい…', 'ひぃ…', 'すみません…'],
  upset: ['わっ!', 'やめてよ…', 'こまるよ…', 'もう…'],
};
const SLAP_WORDS = ['スパーン!!', 'バシッ!!', 'パァン!!', 'ピシャッ!', 'スパァン!'];
const SLAP_BIG = ['ズバァーン!!', 'ドッパーン!!', 'バッシーン!!'];

const rr = (a, b) => a + Math.random() * (b - a);
const rpick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- パーティクル・文字 ----------
function addParticle(p) { if (G.particles.length < 700) G.particles.push(p); }
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = o.a0 != null ? o.a0 + rr(-o.spread, o.spread) : Math.random() * TAU;
    const s = rr(o.s0, o.s1);
    addParticle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), ay: o.ay == null ? 300 : o.ay, drag: o.drag == null ? 2.5 : o.drag, life: rr(o.l0, o.l1), max: 1, size: rr(o.z0, o.z1), color: Array.isArray(o.color) ? rpick(o.color) : o.color, shape: o.shape || 'dot', rot: Math.random() * TAU, vr: rr(-6, 6), grow: o.grow || 0 });
  }
}
function addText(x, y, text, color, size, life) { G.texts.push({ x, y, text, color: color || '#fff', size: size || 20, t: 0, life: life || 0.9, vy: -40, vx: rr(-6, 6) }); }
function say(o, text, style, dur) { o.speech = { text, style: style || 'talk', t: 0, dur: dur || 2.2 }; }

// ---------- 当たり・移動 ----------
function moveBody(o, dx, dy) {
  const W = G.world;
  o.x += dx; o.y += dy;
  for (let pass = 0; pass < 2; pass++) {
    for (const rc of W.rects) {
      if (o.x + o.r < rc.x || o.x - o.r > rc.x + rc.w || o.y + o.r < rc.y || o.y - o.r > rc.y + rc.h) continue;
      const p = circleRectPush(o.x, o.y, o.r, rc);
      if (p) { o.x += p.x; o.y += p.y; }
    }
  }
  o.x = clamp(o.x, 50, W.W - 50); o.y = clamp(o.y, 50, W.H - 50);
}
function separate(a, b, k) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.01;
  const min = a.r + b.r - 2;
  if (d >= min) return;
  const push = (min - d) * (k || 0.5);
  const nx = dx / d; const ny = dy / d;
  if (!a.fixed) moveBody(a, -nx * push, -ny * push);
  if (!b.fixed) moveBody(b, nx * push, ny * push);
}

function setGoal(o, x, y) {
  o.goal = { x, y };
  const p = findPath(G.world, o.x, o.y, x, y);
  o.path = p && p.length ? p : [{ x, y }];
  o.pathI = 0; o.stuckT = 0; o.lastX = o.x; o.lastY = o.y;
}
// 経路に沿って進む。目的地に着いたら true
function followPath(o, speed, dt) {
  if (!o.path || o.pathI >= o.path.length) { o.moving = false; return true; }
  const p = o.path[o.pathI];
  const dx = p.x - o.x; const dy = p.y - o.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) { o.pathI++; if (o.pathI >= o.path.length) { o.moving = false; return true; } return false; }
  const s = Math.min(speed * dt, d);
  moveBody(o, (dx / d) * s, (dy / d) * s);
  if (Math.abs(dx) > 3) o.face = dx > 0 ? 1 : -1;
  o.moving = true; o.walkT += dt * 11;
  // つまったら経路を作り直す
  o.stuckT += dt;
  if (o.stuckT > 0.7) {
    if (Math.hypot(o.x - o.lastX, o.y - o.lastY) < 10) { o.stuckN = (o.stuckN || 0) + 1; setGoal(o, o.goal.x, o.goal.y); if (o.stuckN > 4) { o.pathI = o.path.length; o.moving = false; return true; } }
    else o.stuckN = 0;
    o.stuckT = 0; o.lastX = o.x; o.lastY = o.y;
  }
  return false;
}

// ---------- 作業員 ----------
let nextId = 1;
function makeWorker(kind, x, y) {
  const W = CONFIG.worker;
  const hpBase = W.hp[kind] || 0;
  const hp = kind === 'good' ? 0 : Math.max(2, Math.round(hpBase * G.diff.hpMul * stageHpMul()));
  return { id: nextId++, x, y, r: W.r, vx: 0, vy: 0, face: Math.random() < 0.5 ? 1 : -1, walkT: 0, moving: false, kind, origKind: kind, hp, maxHp: hp, state: 'idle', st: 0, station: null, spot: null, partner: null, target: null, path: null, pathI: 0, speech: null, talkT: rr(0.5, 3), hitT: 0, kbx: 0, kby: 0, reformed: false, relapseT: 0, pretendT: 0, retaliateCd: 0, veg: 'cabbage', workKind: Math.random() < 0.6 ? 'chop' : 'box', badge: rpick(['#4fa4e8', '#ffb347', '#8fd37a', '#f58fb0']), wanderT: rr(25, 60), seed: Math.random() * 100 };
}
function freeStation(x, y, exclude) {
  let best = null; let bd = 1e18;
  for (const s of G.world.stations) {
    if (s.busy && s.busy !== exclude) continue;
    const d = (s.sx - x) ** 2 + (s.sy - y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function takeStation(w, s) {
  if (w.station) w.station.busy = null;
  w.station = s; s.busy = w; w.veg = s.veg === 'mix' ? (Math.random() < 0.5 ? 'cabbage' : 'hakusai') : s.veg;
  if (s.kind === 'pack') w.workKind = 'box';
}
// 作業台の前に立ったときの向き: 縦のラインは台の方を見る。横のラインは左右どちらでも
function faceStation(w) {
  const s = w.station;
  if (s && s.vertical) w.face = s.side < 0 ? 1 : -1;
  else w.face = Math.random() < 0.5 ? 1 : -1;
}
// ステージが進むほど 悪い人は打たれ強い
const stageHpMul = () => (CONFIG.stages[G.stage] && CONFIG.stages[G.stage].hpMul) || 1;
function spawnWorkers() {
  const stg = CONFIG.stages[G.stage];
  const W = G.world;
  const rnd = W.rnd;
  const stations = W.stations.slice();
  for (let i = stations.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [stations[i], stations[j]] = [stations[j], stations[i]]; }
  let si = 0;
  const workers = [];
  // まじめな人: 作業台に
  for (let i = 0; i < stg.good && si < stations.length; i++) {
    const s = stations[si++];
    const w = makeWorker('good', s.sx, s.sy);
    takeStation(w, s); w.state = 'work'; faceStation(w);
    workers.push(w);
  }
  const extra = G.diff.badExtra;
  // サボり: サボり場所に
  const spots = W.spots.slice();
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const nSl = Math.max(1, stg.bad.slacker + extra);
  for (let i = 0; i < nSl; i++) {
    const sp = spots[i % spots.length];
    const w = makeWorker('slacker', sp.x + rr(-6, 6), sp.y + rr(-6, 6));
    w.spot = sp; w.face = sp.dir || 1; w.state = 'slack'; w.pose = sp.kind === 'bench' ? 'phone' : rnd() < 0.5 ? 'lean' : 'phone';
    workers.push(w);
  }
  // 悪口コンビ
  const gs = W.gossipSpots.slice().concat(spots.slice(nSl));
  for (let i = 0; i < stg.bad.gossip; i++) {
    const sp = gs[i % gs.length];
    const a = makeWorker('gossip', sp.x - 17, sp.y); const b = makeWorker('gossip', sp.x + 17, sp.y);
    a.partner = b; b.partner = a; a.face = 1; b.face = -1; a.spot = sp; b.spot = sp; a.state = b.state = 'gossip'; a.gside = -1; b.gside = 1;
    b.talkT = a.talkT + 1.4;
    workers.push(a, b);
  }
  // ジャマする人: ラインのあいだをうろつく
  const nSb = Math.max(1, stg.bad.sabo + (extra > 0 ? 1 : 0));
  for (let i = 0; i < nSb && si < stations.length; i++) {
    const s = stations[si++];
    const w = makeWorker('sabo', s.sx, s.sy);
    w.state = 'idle'; w.st = rr(1, 4);
    workers.push(w);
  }
  G.workers = workers;
}

// 画面に出す目つき: 善人 0、悪人は難易度(cue)で見分けやすさが変わる
function workerEyes(w) {
  const cue = G.diff.cue;
  if (w.kind === 'good') {
    if (w.state === 'stagger') return { mode: 'x' };
    if (w.state === 'cry') return { mode: 'tear', browUp: 1.5 };
    if (w.state === 'upset') return { mean: 0, look: { x: w.face, y: -0.3 }, browUp: 1.5 };
    if (w.state === 'bow') return { mode: 'closed' };
    if (w.state === 'relapse') return { mean: 0.5, look: { x: 0, y: 0.6 } };
    const happy = w.state === 'work' && Math.sin(w.seed + G.clock * 0.7) > 0.86;
    return { mean: 0, mode: happy ? 'happy' : undefined, look: { x: 0, y: 0.4 } };
  }
  if (w.state === 'stagger') return { mode: 'x' };
  if (w.state === 'dizzy') return { mode: 'spiral' };
  if (w.state === 'bow') return { mode: 'closed' };
  const base = { slacker: 0.9, gossip: 1, sabo: 1, minion: 1 }[w.kind] || 1;
  const k = cue === 0 ? 1 : cue === 1 ? 0.95 : 0.82;
  const pretend = w.state === 'pretend';
  const mean = Math.min(1, base * k * (pretend ? (cue === 2 ? 0.72 : 0.82) : 1));
  const grin = !pretend && (cue <= 1 || w.state === 'bother' || w.state === 'gossip');
  const o = { mean, grin, vein: cue <= 1 && !pretend && (w.kind === 'sabo' || w.kind === 'minion' || w.hitT > 0) };
  if (w.kind === 'slacker') { o.droop = pretend ? 0 : 0.6; o.look = { x: 0, y: pretend ? -0.4 : 0.9 }; }
  if (w.kind === 'gossip') { o.smirk = 1; o.look = { x: pretend ? -w.face : w.face * 0.9, y: 0.1 }; }
  if (w.kind === 'sabo' || w.kind === 'minion') { o.look = { x: w.face, y: 0 }; }
  return o;
}

function setState(w, s, dur) { w.state = s; w.st = dur || 0; }
function goWork(w) {
  // 空いている作業台へ歩いていく(なければその場でうろうろ)
  const s = freeStation(w.x, w.y, w);
  if (!s) { setState(w, 'idle', 2); return; }
  takeStation(w, s);
  setGoal(w, s.sx, s.sy);
  setState(w, 'walk');
}
function reform(w) {
  const mult = G.comboMult;
  const pts = Math.round(CONFIG.worker.score.reform * mult);
  G.score += pts;
  G.stats.reforms++;
  addText(w.x, w.y - 60, '改心!', '#ffd24d', 30, 1.3);
  addText(w.x + 20, w.y - 30, '+' + pts, '#fff', 20, 1.1);
  burst(w.x, w.y - 30, 16, { s0: 60, s1: 160, l0: 0.5, l1: 1, z0: 3, z1: 6, color: ['#ffd24d', '#fff', '#8fd37a'], shape: 'star', ay: 60, up: 60 });
  burst(w.x, w.y - 40, 6, { s0: 20, s1: 50, l0: 0.9, l1: 1.4, z0: 4, z1: 7, color: ['#ff7aa8', '#ff9ec4'], shape: 'heart', ay: -40, up: 40 });
  Sound.sfx.reform();
  say(w, rpick(LINES.reform), 'talk', 1.6);
  setState(w, 'bow', 1.6);
  w.kind = 'good'; w.reformed = true; w.hp = 0;
  w.relapseT = G.diff.relapse * CONFIG.stages[G.stage].relapseMul * rr(0.85, 1.2);
  if (w.partner) { w.partner.partner = null; w.partner = null; }
  if (w.station) { w.station.busy = null; w.station = null; }
  // ボスのゲージ
  if (!G.boss && G.phase === 'hunt') {
    G.gauge++;
    Sound.sfx.gauge();
    if (G.gauge >= G.gaugeNeed) spawnBoss();
    else UI.toast(`改心 ${G.gauge}/${G.gaugeNeed}  あと ${G.gaugeNeed - G.gauge}人で おばさんが 出てくる…`, 2200);
  }
}
function relapse(w) {
  w.kind = w.origKind === 'minion' ? 'sabo' : w.origKind;
  w.reformed = false;
  w.hp = w.maxHp = Math.max(2, Math.round((CONFIG.worker.hp[w.kind] || 4) * G.diff.hpMul * stageHpMul()));
  G.stats.relapses++;
  say(w, rpick(LINES.relapse), 'think', 1.8);
  Sound.sfx.relapse();
  if (w.station) { w.station.busy = null; w.station = null; }
  setState(w, 'relapse', 1.4);
  burst(w.x, w.y - 44, 6, { s0: 10, s1: 30, l0: 0.6, l1: 1, z0: 3, z1: 5, color: '#a24be0', shape: 'ring', ay: -30 });
}

function pickSaboTarget(w) {
  const cands = G.workers.filter((o) => o !== w && o.kind === 'good' && o.state === 'work' && o.station && !o.victimT);
  if (!cands.length) return null;
  cands.sort((a, b) => dist(a.x, a.y, w.x, w.y) - dist(b.x, b.y, w.x, w.y));
  return cands[Math.floor(Math.random() * Math.min(3, cands.length))];
}

function updateWorker(w, dt) {
  const P = G.player;
  const W = CONFIG.worker;
  w.st -= dt; w.hitT = Math.max(0, w.hitT - dt); w.retaliateCd -= dt; w.victimT = Math.max(0, (w.victimT || 0) - dt);
  if (w.speech) { w.speech.t += dt; if (w.speech.t > w.speech.dur) w.speech = null; }
  w.moving = false;
  // ふっとび
  if (Math.abs(w.kbx) + Math.abs(w.kby) > 1) { moveBody(w, w.kbx * dt, w.kby * dt); const f = Math.exp(-7 * dt); w.kbx *= f; w.kby *= f; }
  const dP = dist(w.x, w.y, P.x, P.y);
  w.talkT -= dt;
  const cue = G.diff.cue;

  // 改心した人の再発タイマー
  if (w.reformed && w.state !== 'bow' && w.state !== 'stagger') {
    w.relapseT -= dt;
    if (w.relapseT <= 0) { relapse(w); return; }
  }

  switch (w.state) {
    case 'stagger': if (w.st <= 0) { if (w.kind === 'good') { setState(w, 'upset', 1.6); say(w, rpick(w.reformed ? LINES.reformedHit : LINES.goodHit), 'talk', 1.6); } else setState(w, 'idle', 0.3); } break;
    case 'lunge': { // 逆ギレの体当たり
      const dx = P.x - w.x; const dy = P.y - w.y; const d = Math.hypot(dx, dy) || 1;
      moveBody(w, (dx / d) * 300 * dt, (dy / d) * 300 * dt); w.moving = true; w.walkT += dt * 16; w.face = dx > 0 ? 1 : -1;
      if (d < w.r + P.r + 4) { hurtPlayer(W.retaliateDmg, w); setState(w, 'idle', 0.6); }
      else if (w.st <= 0) setState(w, 'idle', 0.4);
      break;
    }
    case 'bow': if (w.st <= 0) { if (w.kind === 'good') goWork(w); else setState(w, 'idle', 0.5); } break;
    case 'relapse': if (w.st <= 0) { if (w.kind === 'slacker' || w.kind === 'gossip') { const sp = w.spot || rpick(G.world.spots); w.spot = sp; setGoal(w, sp.x + (w.gside || 0) * 17, sp.y); setState(w, 'walkBack'); } else setState(w, 'idle', 0.5); } break;
    case 'walkBack': if (followPath(w, W.speed, dt)) { if (w.kind === 'gossip') { setState(w, 'gossip'); const mate = G.workers.find((o) => o !== w && o.kind === 'gossip' && !o.partner && o.spot === w.spot); if (mate) { w.partner = mate; mate.partner = w; } } else { setState(w, 'slack'); w.pose = Math.random() < 0.5 ? 'lean' : 'phone'; } } break;
    case 'upset': if (w.st <= 0) { if (w.station) { setState(w, 'work'); } else goWork(w); } break;
    case 'cry': if (w.st <= 0) { setState(w, w.station ? 'work' : 'idle'); if (!w.station) goWork(w); } break;
    case 'walk': {
      if (followPath(w, W.speed, dt)) {
        if (w.kind === 'good') { if (w.station) { setState(w, 'work'); faceStation(w); } else goWork(w); }
        else if (w.kind === 'sabo' || w.kind === 'minion') {
          if (w.target && w.target.kind === 'good' && dist(w.x, w.y, w.target.x, w.target.y) < 60) { setState(w, 'bother', 2.4); w.face = w.target.x > w.x ? 1 : -1; w.target.victimT = 4; say(w, rpick(w.kind === 'minion' ? LINES.minion : LINES.sabo), 'talk', 2); }
          else setState(w, 'idle', rr(0.5, 1.5));
        } else setState(w, 'idle', 1);
      }
      break;
    }
    case 'work': {
      if (w.kind !== 'good') { setState(w, 'idle', 0.5); break; }
      if (!w.station) { goWork(w); break; }
      if (w.talkT <= 0) { w.talkT = rr(6, 14); if (Math.random() < 0.6) say(w, rpick(LINES.good), 'talk', 1.8); }
      // たまに別の台へ移る(まじめな人も歩くので、歩いているだけでは悪人とは言えない)
      w.wanderT -= dt;
      if (w.wanderT <= 0 && !w.reformed) { w.wanderT = rr(30, 70); const s = freeStation(w.x + rr(-700, 700), w.y + rr(-500, 500), w); if (s && s !== w.station) { takeStation(w, s); setGoal(w, s.sx, s.sy); setState(w, 'walk'); } }
      break;
    }
    case 'slack': {
      if (cue >= 1 && dP < W.pretendRadius) { setState(w, 'pretend'); say(w, rpick(LINES.pretend), 'talk', 1.6); break; }
      if (w.talkT <= 0) { w.talkT = rr(W.talkEvery[0], W.talkEvery[1]) + 1; say(w, rpick(LINES.slacker), w.pose === 'phone' ? 'think' : 'talk', 2); if (Math.random() < 0.4) w.pose = w.pose === 'lean' ? 'phone' : 'lean'; }
      break;
    }
    case 'pretend': {
      if (dP > W.pretendRadius + 70) { w.pretendT += dt; if (w.pretendT > 0.9) { w.pretendT = 0; setState(w, w.origKind === 'gossip' ? 'gossip' : 'slack'); } } else w.pretendT = 0;
      if (w.kind === 'gossip' && w.partner) w.face = w.partner.x > w.x ? 1 : -1;
      break;
    }
    case 'gossip': {
      if (!w.partner) { // ひとりになった: サボりになる
        w.kind = 'slacker'; w.origKind = 'slacker'; setState(w, 'slack'); w.pose = 'lean'; break;
      }
      w.face = w.partner.x > w.x ? 1 : -1;
      if (cue >= 1 && dP < W.pretendRadius) { setState(w, 'pretend'); say(w, '…', 'talk', 1.2); break; }
      if (w.talkT <= 0) { w.talkT = rr(W.talkEvery[0], W.talkEvery[1]); say(w, rpick(LINES.gossip), 'whisper', 2.2); if (w.partner.talkT < 1.2) w.partner.talkT = 1.2; }
      break;
    }
    case 'bother': {
      if (!w.target || w.target.kind !== 'good') { setState(w, 'idle', 0.5); break; }
      const tg = w.target;
      if (tg.state === 'work') { setState(tg, 'upset', 1.5); say(tg, rpick(LINES.upset), 'talk', 1.4); G.stats.bothers++; burst(tg.x, tg.y - 20, 4, { s0: 40, s1: 90, l0: 0.5, l1: 0.9, z0: 5, z1: 8, color: ['#d9a86a', '#e9c389'], shape: 'box', ay: 400, up: 120 }); }
      else if (tg.state === 'upset') tg.st = Math.max(tg.st, 0.6);
      if (w.st <= 0) { setState(w, 'idle', rr(1, 2.5)); }
      break;
    }
    case 'idle': default: {
      if (w.st <= 0) {
        if (w.kind === 'good') goWork(w);
        else if (w.kind === 'sabo' || w.kind === 'minion') {
          const tg = pickSaboTarget(w);
          if (tg) { w.target = tg; const side = tg.station ? -tg.face : 1; setGoal(w, tg.x + side * 36, tg.y + 6); setState(w, 'walk'); }
          else { const c = rpick(G.world.freeCells); setGoal(w, c[0], c[1]); setState(w, 'walk'); }
        } else if (w.kind === 'slacker') { const sp = w.spot || rpick(G.world.spots); w.spot = sp; setGoal(w, sp.x, sp.y); setState(w, 'walkBack'); }
        else if (w.kind === 'gossip') { const sp = w.spot || rpick(G.world.gossipSpots); w.spot = sp; setGoal(w, sp.x + (w.gside || 1) * 17, sp.y); setState(w, 'walkBack'); }
      }
    }
  }
}

// 作業員の「見た目のポーズ」
function workerPose(w) {
  switch (w.state) {
    case 'work': return 'work';
    case 'walk': case 'walkBack': case 'lunge': return 'walk';
    case 'slack': return w.pose || 'lean';
    case 'gossip': return 'gossip';
    case 'bother': return 'bother';
    case 'bow': return 'bow';
    case 'upset': return 'upset';
    case 'cry': return 'cry';
    case 'pretend': return 'pretend';
    case 'stagger': return 'stagger';
    case 'relapse': return 'lean';
    default: return 'idle';
  }
}

// ---------- プレイヤー ----------
function makePlayer() {
  const s = G.world.start;
  return { x: s.x, y: s.y, r: CONFIG.player.r, vx: 0, vy: 0, aim: -Math.PI / 2, walkT: 0, moving: false, hp: CONFIG.player.maxHp, hurtT: 0, invT: 0, stunT: 0, sadT: 0, happyT: 0, harisen: 'normal', uses: Infinity, swingCd: 0, swingT: 0, swingDur: 0.14, swingDir: 1, kbx: 0, kby: 0 };
}
function hurtPlayer(dmg, from) {
  const P = G.player;
  if (P.invT > 0 || G.state !== 'playing') return;
  P.hp = Math.max(0, P.hp - dmg);
  P.hurtT = 0.4; P.invT = CONFIG.player.invuln;
  G.cam.shake = Math.max(G.cam.shake, 8);
  G.redFlash = 1;
  if (from) { const dx = P.x - from.x; const dy = P.y - from.y; const d = Math.hypot(dx, dy) || 1; P.kbx += (dx / d) * 260; P.kby += (dy / d) * 260; }
  Sound.sfx.hurt();
  addText(P.x, P.y - 60, '-' + dmg, '#ff5a5e', 20, 0.8);
  G.combo = 0;
  if (P.hp <= 0) endGame('down');
}
function updatePlayer(dt) {
  const P = G.player;
  const C = CONFIG.player;
  P.hurtT = Math.max(0, P.hurtT - dt); P.invT = Math.max(0, P.invT - dt); P.stunT = Math.max(0, P.stunT - dt); P.sadT = Math.max(0, P.sadT - dt); P.happyT = Math.max(0, P.happyT - dt);
  P.swingCd = Math.max(0, P.swingCd - dt); P.swingT = Math.max(0, P.swingT - dt);
  const mv = P.stunT > 0 ? { x: 0, y: 0 } : Input.move();
  const tvx = mv.x * C.speed; const tvy = mv.y * C.speed;
  P.vx = approach(P.vx, tvx, C.accel * dt); P.vy = approach(P.vy, tvy, C.accel * dt);
  P.moving = Math.hypot(mv.x, mv.y) > 0.1;
  if (P.moving) P.walkT += dt * 11;
  moveBody(P, (P.vx + P.kbx) * dt, (P.vy + P.kby) * dt);
  const f = Math.exp(-8 * dt); P.kbx *= f; P.kby *= f;
  // ねらい
  const V = G.view;
  const sx = (P.x - V.left) * V.zoom; const sy = (P.y - V.top) * V.zoom;
  const moveAngle = P.moving ? Math.atan2(mv.y, mv.x) : null;
  const a = Input.aim(sx, sy, moveAngle);
  // タッチ: 移動していてねらっていないときは進む向き
  P.aim = a.angle;
  if (a.fire && P.swingCd <= 0 && P.stunT <= 0 && G.state === 'playing') swing();
}

// ---------- ハリセン ----------
function swing() {
  const P = G.player;
  const H = CONFIG.harisen[P.harisen];
  P.swingCd = 1 / H.rate;
  P.swingDur = Math.min(0.2, 0.8 / H.rate);
  P.swingT = P.swingDur;
  P.swingDir *= -1;
  Sound.sfx.swing(P.harisen === 'jumbo');
  G.swings.push({ x: P.x, y: P.y - 20, aim: P.aim, range: H.range, arc: (H.arc * Math.PI) / 180, dir: P.swingDir, t: 0, dur: 0.2, type: P.harisen });
  G.stats.swings++;
  const arc = (H.arc * Math.PI) / 180;
  let hitAny = false;
  const hitList = [];
  for (const w of G.workers) {
    if (w.state === 'bow' || w.state === 'relapse') continue;
    if (inSwingArc(P.x, P.y, P.aim, H.range, arc, w.x, w.y - 10, w.r + 4)) hitList.push(w);
  }
  // 扇の中に悪い人がいれば、ねらったのはその人: まじめな人は巻きこまない(まちがいは「見分けの失敗」だけにする)
  const B = G.boss;
  const bossHit = !!(B && !B.dead && B.state !== 'defeated' && inSwingArc(P.x, P.y, P.aim, H.range + 10, arc, B.x, B.y - 20, B.r + 8));
  const anyBad = bossHit || hitList.some((w) => w.kind !== 'good');
  for (const w of hitList) { if (anyBad && w.kind === 'good') continue; hitWorker(w, H, false); hitAny = true; }
  if (bossHit) { hitBoss(B, H); hitAny = true; }
  // ビリビリ: 当たった悪い人から近くの悪い人へ電気がはしる
  if (hitAny && H.chain) {
    const src = hitList.filter((w) => w.kind !== 'good');
    const done = new Set(src);
    for (const s of src) {
      for (const w of G.workers) {
        if (done.has(w) || w.kind === 'good' || w.state === 'bow') continue;
        if (dist(s.x, s.y, w.x, w.y) < H.chain) { done.add(w); G.zaps.push({ x0: s.x, y0: s.y - 25, x1: w.x, y1: w.y - 25, t: 0 }); hitWorker(w, { dmg: H.chainDmg, kb: 60, shake: 2, stun: H.stun, chainHit: true }, true); }
      }
      if (B && !B.dead && B.state !== 'defeated' && !done.has(B) && dist(s.x, s.y, B.x, B.y) < H.chain) { G.zaps.push({ x0: s.x, y0: s.y - 25, x1: B.x, y1: B.y - 40, t: 0 }); hitBoss(B, { dmg: H.chainDmg, kb: 30, shake: 2, chainHit: true }); }
    }
    Sound.sfx.zap();
  }
  if (hitAny && P.uses !== Infinity) {
    P.uses--;
    if (P.uses <= 0) { P.harisen = 'normal'; P.uses = Infinity; UI.toast('ハリセンが ボロボロに… ふつうのハリセンに もどった', 2400); Sound.sfx.wornOut(); }
  }
}
function comboHit() {
  if (G.comboT > 0) G.combo++; else G.combo = 1;
  G.comboT = CONFIG.player.comboWindow;
  G.comboMult = comboMultiplier(G.combo);
  G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
}
function slapFx(x, y, big, aim, color) {
  const P = G.player;
  addText(x + rr(-6, 6), y - 48, big ? rpick(SLAP_BIG) : rpick(SLAP_WORDS), color || '#fff', big ? 34 : 26, 0.55);
  G.impacts.push({ x, y: y - 20, t: 0, big });
  burst(x, y - 20, big ? 14 : 8, { a0: aim, spread: 1.1, s0: 120, s1: 300, l0: 0.25, l1: 0.5, z0: 2, z1: 4, color: ['#fff', '#ffe14d', '#ffd24d'], shape: 'spark', ay: 0, drag: 4 });
  burst(x, y, 6, { s0: 30, s1: 90, l0: 0.4, l1: 0.8, z0: 5, z1: 9, color: ['rgba(200,200,220,0.6)', 'rgba(230,230,240,0.7)'], shape: 'dust', ay: -20, grow: 6 });
  G.cam.shake = Math.max(G.cam.shake, big ? 10 : 5);
  G.cam.kx = Math.cos(aim) * (big ? 9 : 5); G.cam.ky = Math.sin(aim) * (big ? 9 : 5);
  G.hitStop = Math.max(G.hitStop, big ? 0.075 : 0.045);
  P.happyT = 0.5;
}
function hitWorker(w, H, chain) {
  const P = G.player;
  const S = CONFIG.worker.score;
  const aim = Math.atan2(w.y - P.y, w.x - P.x);
  const big = P.harisen === 'jumbo' && !chain;
  w.hitT = 0.5;
  w.kbx += Math.cos(aim) * H.kb; w.kby += Math.sin(aim) * H.kb;
  w.face = Math.cos(aim) > 0 ? -1 : 1; // 叩かれた方を見る
  if (w.kind === 'good') {
    // 真面目な人を叩いてしまった
    G.score = Math.max(0, G.score + S.goodHit);
    G.combo = 0; G.comboT = 0; G.comboMult = 1;
    G.stats.wrongHits++;
    P.hp = Math.max(0, P.hp - CONFIG.worker.goodHitHp); P.sadT = 1.4;
    G.blueFlash = 1;
    addText(w.x, w.y - 56, w.reformed ? '改心した人だよ!' : 'まじめな人!', '#5ab0ff', 22, 1.1);
    addText(w.x + 10, w.y - 30, S.goodHit + '', '#5ab0ff', 20, 1);
    Sound.sfx.wrong(); Sound.sfx.ouch();
    G.cam.shake = Math.max(G.cam.shake, 4);
    setState(w, 'stagger', 0.45);
    if (w.station && w.state !== 'work') { /* 台はそのまま、落ち着いたら戻る */ }
    if (P.hp <= 0) endGame('down');
    return;
  }
  // 悪い人
  comboHit();
  const pts = S.hit;
  G.score += pts; G.stats.hits++;
  slapFx(w.x, w.y, big, aim);
  if (!chain) Sound.sfx.slap(G.combo, big);
  w.hp -= H.dmg;
  if (w.state === 'bother' && w.target) w.target = null;
  if (w.hp <= 0) { reform(w); return; }
  if (H.stun) { setState(w, 'dizzy', H.stun); Sound.sfx.dizzy(); }
  else {
    setState(w, 'stagger', 0.42);
    if (Math.random() < 0.5) say(w, rpick(LINES.badHit), 'talk', 0.9);
    // 逆ギレ
    if (!chain && w.retaliateCd <= 0 && Math.random() < G.diff.retaliate) { w.retaliateCd = 3; setState(w, 'lunge', 0.5); say(w, rpick(LINES.retaliate), 'shout', 0.8); G.stats.retaliates++; }
  }
}

// ---------- ボス ----------
function spawnBoss() {
  const stg = CONFIG.stages[G.stage];
  const bc = stg.boss;
  const W = G.world;
  const hp = Math.round(bc.hp * G.diff.bossHpMul);
  G.boss = { x: W.dock.x, y: W.dock.y + 30, r: CONFIG.boss.r, hp, maxHp: hp, state: 'enter', st: 2.2, face: 1, walkT: 0, moving: false, path: null, pathI: 0, target: null, hits: 0, hitT: 0, shoutCd: 3, throwCd: 2, speech: null, level: G.stage, dead: false, name: bc.name, speed: bc.speed, throw: bc.throw, minions: bc.minions, minionT: 6, kbx: 0, kby: 0, look: null, flash: 0, hitFlash: 0 };
  G.phase = 'boss';
  G.bossIntro = 2.6;
  say(G.boss, rpick(LINES.bossEnter), 'shout', 2.4);
  UI.banner(bc.name + ' 登場!');
  UI.toast(bc.title + '「' + bc.name + '」が やってきた! いびっている あいだは ダメージ2倍!', 3600);
  Sound.sfx.bossAppear();
  Sound.setBgmMode('boss');
  G.cam.shake = 14;
  G.stats.bossSeen = true;
  // 入口の前に立っている人は押しのける
  for (const w of G.workers) if (dist(w.x, w.y, G.boss.x, G.boss.y) < 80) { w.kbx += (w.x - G.boss.x) * 4; w.kby += 200; }
}
function bossPickTarget(B) {
  const cands = G.workers.filter((w) => w.kind === 'good' && (w.state === 'work' || w.state === 'upset') && w.station);
  if (!cands.length) return null;
  cands.sort((a, b) => dist(a.x, a.y, B.x, B.y) - dist(b.x, b.y, B.x, B.y));
  return cands[Math.floor(Math.random() * Math.min(3, cands.length))];
}
function hitBoss(B, H) {
  const P = G.player;
  const C = CONFIG.boss;
  const aim = Math.atan2(B.y - P.y, B.x - P.x);
  const big = P.harisen === 'jumbo' && !H.chainHit;
  const weak = B.state === 'scold' || B.state === 'stun';
  let dmg = H.dmg * (weak ? C.weakMul : 1);
  B.hp -= dmg; B.hitT = 1.2; B.hits++; B.hitFlash = 0.3;
  comboHit();
  const pts = Math.round(CONFIG.worker.score.bossHit * (weak ? 2 : 1) * G.comboMult);
  G.score += pts; G.stats.bossHits++;
  slapFx(B.x, B.y - 20, big, aim, weak ? '#ffd24d' : '#fff');
  if (weak) addText(B.x + 30, B.y - 90, B.state === 'stun' ? 'めまい中 2倍!' : 'よそ見中 2倍!', '#ffd24d', 18, 0.8);
  addText(B.x - 20, B.y - 60, '+' + pts, '#fff', 18, 0.9);
  if (!H.chainHit) Sound.sfx.bossHit(G.combo);
  B.kbx += Math.cos(aim) * H.kb * 0.4; B.kby += Math.sin(aim) * H.kb * 0.4;
  B.face = Math.cos(aim) > 0 ? -1 : 1;
  if (B.hp <= 0) { bossDefeated(B); return; }
  if (B.state === 'stun') return;
  if (B.hits >= C.stunHits) { B.hits = 0; B.state = 'stun'; B.st = C.stunTime; say(B, '…ぐるぐる…', 'think', C.stunTime); Sound.sfx.bossStun(); G.stats.bossStuns++; return; }
  if (B.state !== 'scold' && B.state !== 'windup' && B.state !== 'shout') { // いびり中は夢中で気づかない。ガミガミは殴られても止まらない
    if (B.hits % 3 === 1) { B.state = 'stagger'; B.st = 0.22; B.path = null; } // 3発に1回だけひるむ(連打で固まらない)
    if (Math.random() < 0.4) say(B, rpick(LINES.bossHit), 'shout', 0.9);
  }
}
function bossDefeated(B) {
  B.state = 'defeated'; B.st = 3.2; B.dead = false;
  const pts = Math.round(CONFIG.worker.score.bossDown * Math.max(1, G.comboMult * 0.7));
  G.score += pts; G.stats.boss = true;
  addText(B.x, B.y - 110, '+' + pts, '#ffd24d', 30, 1.6);
  say(B, rpick(LINES.bossDown), 'talk', 3);
  burst(B.x, B.y - 50, 36, { s0: 80, s1: 260, l0: 0.6, l1: 1.4, z0: 3, z1: 8, color: ['#ffd24d', '#fff', '#ff7aa8', '#8fd37a', '#5ab0ff'], shape: 'star', ay: 120, up: 120 });
  Sound.sfx.bossDown();
  G.cam.shake = 16; G.hitStop = Math.max(G.hitStop, 0.25);
  UI.banner('改心させた!');
  for (const w of G.workers) if (w.state === 'cry') setState(w, 'upset', 0.5);
  G.phase = 'won';
  G.wonT = 0;
}
function updateBoss(B, dt) {
  const P = G.player;
  const C = CONFIG.boss;
  B.st -= dt; B.hitT = Math.max(0, B.hitT - dt); B.shoutCd -= dt; B.throwCd -= dt; B.hitFlash = Math.max(0, B.hitFlash - dt);
  if (B.hitT <= 0) B.hits = 0;
  if (B.speech) { B.speech.t += dt; if (B.speech.t > B.speech.dur) B.speech = null; }
  B.moving = false;
  if (Math.abs(B.kbx) + Math.abs(B.kby) > 1) { moveBody(B, B.kbx * dt, B.kby * dt); const f = Math.exp(-9 * dt); B.kbx *= f; B.kby *= f; }
  const dP = dist(B.x, B.y, P.x, P.y);
  B.look = { x: clamp((P.x - B.x) / 200, -1, 1), y: clamp((P.y - B.y) / 200, -1, 1) };
  // 手下を呼ぶ(ステージ3)
  if (B.minions && B.state !== 'defeated') {
    B.minionT -= dt;
    const alive = G.workers.filter((w) => w.origKind === 'minion' && w.kind !== 'good').length;
    if (B.minionT <= 0 && alive < B.minions) {
      B.minionT = 18;
      const m = makeWorker('minion', B.x + rr(-30, 30), B.y + 40);
      m.state = 'idle'; m.st = 0.5; G.workers.push(m);
      say(B, 'おまえたち、じゃましてやりなさい!', 'shout', 1.6);
      burst(m.x, m.y - 20, 10, { s0: 40, s1: 120, l0: 0.5, l1: 0.9, z0: 4, z1: 7, color: ['#a24be0', '#6a2a9c'], shape: 'ring', ay: -40 });
    }
  }
  switch (B.state) {
    case 'enter': {
      moveBody(B, 0, B.speed * 0.6 * dt); B.moving = true; B.walkT += dt * 9; B.face = P.x > B.x ? 1 : -1;
      if (B.st <= 0) { B.state = 'seek'; B.st = 0.3; }
      break;
    }
    case 'seek': {
      // プレイヤーが近いならガミガミ、少し離れているならキャベツ
      if (dP < C.shout.range && B.shoutCd <= 0) { B.state = 'windup'; B.st = C.shout.windup; B.path = null; say(B, rpick(LINES.bossShout), 'shout', 1.2); Sound.sfx.yell(); break; }
      if (B.throw && B.throwCd <= 0 && dP > 170 && dP < C.throwRange && lineClear(G.world, B.x, B.y - 20, P.x, P.y - 10, 8)) { B.state = 'throw'; B.st = 0.5; B.threw = false; B.face = P.x > B.x ? 1 : -1; say(B, rpick(LINES.bossThrow), 'shout', 1); break; }
      if (!B.target || B.target.kind !== 'good' || !B.target.station) {
        if (B.st <= 0) { B.target = bossPickTarget(B); if (B.target) { const side = -B.target.face; setGoal(B, B.target.x + side * 46, B.target.y + 4); } else { const c = rpick(G.world.freeCells); setGoal(B, c[0], c[1]); } B.st = C.seekGap; }
        else if (B.path) followPath(B, B.speed, dt);
        break;
      }
      if (followPath(B, B.speed, dt)) {
        if (dist(B.x, B.y, B.target.x, B.target.y) < 90) {
          B.state = 'scold'; B.st = C.scoldTime; B.face = B.target.x > B.x ? 1 : -1;
          const tg = B.target; setState(tg, 'cry', C.scoldTime + 1.2); tg.face = B.x > tg.x ? 1 : -1; say(tg, rpick(LINES.cry), 'talk', 1.5);
          say(B, rpick(LINES.bossScold), 'shout', 1.4); Sound.sfx.yell(); B.scoldTalk = 1.4; G.stats.scolds++;
        } else { B.target = null; B.st = 0.2; }
      }
      break;
    }
    case 'scold': {
      B.scoldTalk -= dt;
      if (B.scoldTalk <= 0) { B.scoldTalk = 1.3; say(B, rpick(LINES.bossScold), 'shout', 1.2); if (B.target && B.target.kind === 'good') { say(B.target, rpick(LINES.cry), 'talk', 1); B.target.st = Math.max(B.target.st, 1.5); } }
      if (B.st <= 0 || !B.target || B.target.kind !== 'good') { B.state = 'seek'; B.st = 0.8; B.target = null; }
      break;
    }
    case 'windup': {
      B.face = P.x > B.x ? 1 : -1;
      if (B.st <= 0) {
        B.state = 'shout'; B.st = 0.35; B.shoutCd = C.shout.cooldown;
        G.rings.push({ x: B.x, y: B.y - 10, r: 20, r1: C.shout.radius, t: 0, dur: 0.35 });
        Sound.sfx.shout(); G.cam.shake = Math.max(G.cam.shake, 9);
        if (dP < C.shout.radius + P.r) { hurtPlayer(C.shout.dmg, B); P.stunT = 0.5; }
        // まわりの作業員もびくっとする
        for (const w of G.workers) if (w.kind === 'good' && dist(w.x, w.y, B.x, B.y) < C.shout.radius && w.state === 'work') { setState(w, 'upset', 1.2); }
      }
      break;
    }
    case 'shout': if (B.st <= 0) { B.state = 'seek'; B.st = 0.6; } break;
    case 'throw': {
      if (!B.threw && B.st < 0.25) {
        B.threw = true; B.throwCd = C.throwCd;
        const lead = 0.35; const tx = P.x + P.vx * lead; const ty = P.y + P.vy * lead;
        const a = Math.atan2(ty - (B.y - 40), tx - B.x);
        G.projectiles.push({ x: B.x + Math.cos(a) * 20, y: B.y - 40, vx: Math.cos(a) * C.throwSpeed, vy: Math.sin(a) * C.throwSpeed, r: 11, life: 1.6, rot: 0 });
        Sound.sfx.throwIt();
      }
      if (B.st <= 0) { B.state = 'seek'; B.st = 0.4; }
      break;
    }
    case 'stagger': if (B.st <= 0) { B.state = 'seek'; B.st = 0.2; } break;
    case 'stun': if (B.st <= 0) { B.state = 'seek'; B.st = 0.4; B.shoutCd = Math.max(B.shoutCd, 1); } break;
    case 'defeated': {
      if (B.st <= 0 && !B.dead) { B.dead = true; }
      break;
    }
  }
}

// ---------- 投げキャベツ ----------
function updateProjectiles(dt) {
  const P = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.rot += dt * 9;
    let dead = p.life <= 0;
    if (!dead && dist(p.x, p.y, P.x, P.y - 10) < p.r + P.r) { hurtPlayer(CONFIG.boss.throwDmg, { x: p.x - p.vx * 0.1, y: p.y - p.vy * 0.1 }); dead = true; }
    if (!dead) for (const rc of G.world.rects) { if (rc.type !== 'belt' && rc.type !== 'table' && pointInRect(p.x, p.y, rc, 0)) { dead = true; break; } }
    if (dead) { burst(p.x, p.y, 10, { s0: 40, s1: 140, l0: 0.4, l1: 0.8, z0: 3, z1: 7, color: ['#7cc24a', '#a4dd6c', '#5fa534'], shape: 'leaf', ay: 300 }); Sound.sfx.splat(); G.projectiles.splice(i, 1); }
  }
}

// ---------- 落ちているハリセン ----------
function spawnPickup() {
  const P = G.player;
  const cells = G.world.freeCells;
  for (let tries = 0; tries < 40; tries++) {
    const c = rpick(cells);
    if (dist(c[0], c[1], P.x, P.y) < 260) continue;
    if (G.world.stations.some((s) => dist(s.sx, s.sy, c[0], c[1]) < 40)) continue;
    if (G.pickups.some((p) => dist(p.x, p.y, c[0], c[1]) < 300)) continue;
    const type = Math.random() < 0.5 ? 'jumbo' : 'spark';
    G.pickups.push({ x: c[0], y: c[1], type, life: CONFIG.pickup.life, t: Math.random() * 10 });
    return;
  }
}
function updatePickups(dt) {
  const P = G.player;
  G.pickupT -= dt;
  if (G.pickupT <= 0) { G.pickupT = CONFIG.pickup.every; if (G.pickups.length < CONFIG.pickup.max) spawnPickup(); }
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i];
    p.life -= dt; p.t += dt;
    if (p.life <= 0) { G.pickups.splice(i, 1); continue; }
    if (dist(p.x, p.y, P.x, P.y) < 30) {
      const H = CONFIG.harisen[p.type];
      P.harisen = p.type; P.uses = H.uses;
      G.stats.pickups++;
      UI.toast(H.name + ' を ひろった! ' + (p.type === 'jumbo' ? 'ひろく つよく ふっとばす!' : '当てると 近くの悪い人にも ビリビリ!') + '(' + H.uses + '回)', 2800);
      Sound.sfx.pickup();
      burst(p.x, p.y - 10, 12, { s0: 40, s1: 120, l0: 0.5, l1: 0.9, z0: 3, z1: 6, color: [H.color, '#fff'], shape: 'star', ay: 80, up: 60 });
      G.pickups.splice(i, 1);
    }
  }
}

// ---------- 全体の更新 ----------
function updateFx(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles[i] = G.particles[G.particles.length - 1]; G.particles.pop(); continue; }
    p.vy += p.ay * dt; const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.grow) p.size += p.grow * dt;
  }
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.t += dt; t.y += t.vy * dt; t.x += t.vx * dt; if (t.t > t.life) G.texts.splice(i, 1); }
  for (let i = G.swings.length - 1; i >= 0; i--) { const s = G.swings[i]; s.t += dt; if (s.t > s.dur) G.swings.splice(i, 1); }
  for (let i = G.impacts.length - 1; i >= 0; i--) { const s = G.impacts[i]; s.t += dt; if (s.t > 0.22) G.impacts.splice(i, 1); }
  for (let i = G.zaps.length - 1; i >= 0; i--) { const s = G.zaps[i]; s.t += dt; if (s.t > 0.22) G.zaps.splice(i, 1); }
  for (let i = G.rings.length - 1; i >= 0; i--) { const s = G.rings[i]; s.t += dt; if (s.t > s.dur + 0.2) G.rings.splice(i, 1); }
  G.redFlash = Math.max(0, (G.redFlash || 0) - dt * 2.5);
  G.blueFlash = Math.max(0, (G.blueFlash || 0) - dt * 2);
}

function updateGame(dt) {
  if (G.state !== 'playing') { updateFx(dt); return; }
  G.timeLeft -= dt;
  if (G.timeLeft <= 0) { G.timeLeft = 0; endGame('time'); return; }
  G.comboT = Math.max(0, G.comboT - dt);
  if (G.comboT <= 0 && G.combo > 0) { G.combo = 0; G.comboMult = 1; }
  if (G.bossIntro > 0) G.bossIntro -= dt;
  updatePlayer(dt);
  for (const w of G.workers) updateWorker(w, dt);
  // 人どうしの押しあい
  const P = G.player;
  for (let i = 0; i < G.workers.length; i++) {
    const a = G.workers[i];
    if (Math.abs(a.x - P.x) < 40 && Math.abs(a.y - P.y) < 40) separate(a, P, 0.5);
    for (let j = i + 1; j < G.workers.length; j++) { const b = G.workers[j]; if (Math.abs(a.x - b.x) < 34 && Math.abs(a.y - b.y) < 34) separate(a, b, 0.5); }
  }
  if (G.boss) {
    updateBoss(G.boss, dt);
    if (Math.abs(G.boss.x - P.x) < 60 && Math.abs(G.boss.y - P.y) < 60) separate(G.boss, P, 0.5);
    for (const w of G.workers) if (Math.abs(w.x - G.boss.x) < 50 && Math.abs(w.y - G.boss.y) < 50) separate(G.boss, w, 0.5);
    if (G.phase === 'won') { G.wonT += dt; if (G.wonT > 3.4) stageClear(); }
  }
  updateProjectiles(dt);
  updatePickups(dt);
  updateFx(dt);
  // ステージ開始のヒント: 最初の悪い人を見つけたら
  if (!G.stats.firstHint) {
    for (const w of G.workers) if (w.kind !== 'good' && dist(w.x, w.y, P.x, P.y) < 230) { G.stats.firstHint = true; UI.toast('目つきが わるい人を 見つけた! ハリセンで なんども たたこう', 3000); break; }
  }
}

function resetGame() {
  const seed = (Date.now() % 100000) + 1;
  G.world = buildWorld(G.stage, G.useSeed || seed);
  G.player = makePlayer();
  nextId = 1;
  spawnWorkers();
  G.boss = null;
  G.pickups = []; G.projectiles = []; G.particles = []; G.texts = []; G.swings = []; G.impacts = []; G.zaps = []; G.rings = [];
  G.score = 0; G.combo = 0; G.comboT = 0; G.comboMult = 1;
  G.timeLeft = G.diff.time + (CONFIG.stages[G.stage].timeAdd || 0);
  G.timeTotal = G.timeLeft;
  G.gauge = 0; G.gaugeNeed = G.diff.needReform[G.stage];
  G.phase = 'hunt'; G.bossIntro = 0; G.wonT = 0;
  G.pickupT = CONFIG.pickup.first;
  G.hitStop = 0; G.redFlash = 0; G.blueFlash = 0;
  G.stats = { hits: 0, reforms: 0, relapses: 0, wrongHits: 0, bestCombo: 0, bossHits: 0, bossStuns: 0, boss: false, bossSeen: false, swings: 0, pickups: 0, retaliates: 0, bothers: 0, scolds: 0, firstHint: false };
}
