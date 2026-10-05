'use strict';
/* 起動・状態遷移(タイトル → ステージ → クリア/ゲームオーバー)・メインループ・画面表示(HUD) */

const $ = (id) => document.getElementById(id);

const UI = {
  el: {},
  toastTimer: 0,
  last: {},
  init() {
    for (const id of ['hud', 'hpFill', 'hpText', 'score', 'combo', 'comboN', 'comboM', 'comboFill', 'timer', 'stageLabel', 'gauge', 'gaugeFill', 'gaugeText', 'bossBar', 'bossFill', 'bossName', 'weapon', 'weaponName', 'weaponUses', 'btnSound', 'btnPause', 'toast', 'banner', 'hint',
      'title', 'pause', 'result', 'touchHints', 'thL', 'thR', 'btnStart', 'btnResume', 'btnQuit', 'btnRetry', 'btnNext', 'btnToTitle', 'bestTitle', 'resTitle', 'resRank', 'resMsg', 'resScore', 'resNew', 'resStats', 'howto', 'btnHowto', 'btnHowtoClose', 'eyeGood', 'eyeBad', 'eyeBoss', 'legendPics', 'btnWhack', 'btnWhackAgain', 'btnWhackTitle', 'whackBestTitle']) {
      this.el[id] = $(id);
    }
  },
  show(id, on) { this.el[id].classList.toggle('hidden', !on); },
  toast(msg, ms) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastTimer);
    if (this.el.hint) this.el.hint.classList.add('hidden');
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2600);
  },
  banner(text) {
    const b = this.el.banner;
    b.textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    setTimeout(() => b.classList.add('hidden'), 1300);
  },
  set(key, val, fn) { if (this.last[key] === val) return; this.last[key] = val; fn(val); },
  updateHud() {
    if (G.state === 'title') return;
    const P = G.player;
    const e = this.el;
    const hp = Math.ceil(P.hp);
    this.set('hp', hp, (v) => {
      e.hpFill.style.width = Math.min(100, (v / CONFIG.player.maxHp) * 100) + '%';
      e.hpFill.className = 'hp-fill' + (v <= 30 ? ' low' : v <= 60 ? ' mid' : '');
      e.hpText.textContent = v;
    });
    if (G.dispScore < G.score) G.dispScore = Math.min(G.score, G.dispScore + Math.max(3, Math.ceil((G.score - G.dispScore) * 0.2)));
    else if (G.dispScore > G.score) G.dispScore = Math.max(G.score, G.dispScore - Math.max(3, Math.ceil((G.dispScore - G.score) * 0.2)));
    this.set('score', G.dispScore, (v) => { e.score.textContent = v.toLocaleString('en-US'); e.score.classList.remove('bump'); void e.score.offsetWidth; e.score.classList.add('bump'); });
    const sec = Math.ceil(G.timeLeft);
    this.set('time', sec, (v) => { e.timer.textContent = Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); e.timer.classList.toggle('warn', v <= 30 && G.state === 'playing'); });
    this.set('stage', G.stage, (v) => { e.stageLabel.textContent = 'ステージ' + (v + 1) + ' ' + CONFIG.stages[v].name; });
    const showCombo = G.combo >= 2 && G.state === 'playing';
    this.set('comboShow', showCombo, (v) => e.combo.classList.toggle('hidden', !v));
    if (showCombo) {
      this.set('combo', G.combo, (v) => { e.comboN.textContent = v + ' COMBO'; e.comboM.textContent = 'x' + G.comboMult; e.combo.style.animation = 'none'; void e.combo.offsetWidth; e.combo.style.animation = ''; });
      e.comboFill.style.width = clamp(G.comboT / CONFIG.player.comboWindow, 0, 1) * 100 + '%';
    }
    // 改心ゲージ / ボスのHP
    const B = G.boss;
    this.set('gaugeShow', !B, (v) => e.gauge.classList.toggle('hidden', !v));
    if (!B) { this.set('gauge', G.gauge, (v) => { e.gaugeFill.style.width = clamp(v / G.gaugeNeed, 0, 1) * 100 + '%'; e.gaugeText.textContent = '改心 ' + v + ' / ' + G.gaugeNeed + ' で おばさん 登場'; }); }
    this.set('bossShow', !!(B && !B.dead && B.state !== 'defeated'), (v) => { e.bossBar.classList.toggle('hidden', !v); if (B) e.bossName.textContent = B.name; });
    if (B) e.bossFill.style.width = clamp(B.hp / B.maxHp, 0, 1) * 100 + '%';
    // ハリセン
    const H = CONFIG.harisen[P.harisen];
    this.set('weapon', P.harisen + ':' + P.uses, () => { e.weaponName.textContent = H.name; e.weaponUses.textContent = P.uses === Infinity ? '∞' : 'のこり ' + P.uses + '回'; e.weapon.className = 'weapon ' + P.harisen; });
  },
};

// ---------- 保存(ハイスコア・進行) ----------
function loadSave() { try { const s = JSON.parse(localStorage.getItem('harisen_save') || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function saveSave(s) { try { localStorage.setItem('harisen_save', JSON.stringify(s)); } catch (e) { /* 保存できなくても遊べる */ } }
function bestFor(diff) { const s = loadSave(); return (s.best && s.best[diff]) || 0; }
function clearedStages() { const s = loadSave(); return s.cleared || 0; } // 何ステージまでクリアしたか

// ---------- 状態遷移 ----------
function startGame(stage) {
  Sound.init();
  Sound.sfx.start();
  G.stage = stage == null ? G.selStage : stage;
  G.diff = CONFIG.diff[G.diffKey];
  resetGame();
  Sound.setBgmMode('normal');
  Sound.startBgm('normal');
  G.state = 'playing'; G.paused = false;
  G.dispScore = 0; G.overT = 0;
  if (stage == null || stage === 0) G.stageScores = []; // 通しのスコアはステージ1から数えなおす
  UI.last = {};
  for (const id of ['title', 'pause', 'result', 'howto']) UI.show(id, false);
  UI.show('hud', true);
  UI.banner('ステージ' + (G.stage + 1) + ' ' + CONFIG.stages[G.stage].name);
  UI.show('hint', true);
  clearTimeout(G.hintTimer);
  G.hintTimer = setTimeout(() => UI.show('hint', false), 7000);
  for (const id of ['thL', 'thR']) UI.el[id].classList.remove('gone');
  UI.el.touchHints.classList.add('show');
  clearTimeout(G.thTimer);
  G.thTimer = setTimeout(() => UI.el.touchHints.classList.remove('show'), 12000);
  requestWakeLock();
  armBackGuard();
  Render.buildMini();
  G.cam.x = G.player.x; G.cam.y = G.player.y - 60;
}

function endGame(reason) {
  if (G.state !== 'playing') return;
  G.state = 'over';
  G.over = { reason };
  G.overT = 0;
  Input.releaseAll();
  Sound.stopBgm();
  Sound.sfx.over();
  UI.show('hint', false);
  UI.banner(reason === 'time' ? 'タイムアップ…' : 'ダウン…');
}
function stageClear() {
  if (G.state !== 'playing') return;
  G.state = 'clear';
  G.overT = 0;
  const bonus = Math.round(G.timeLeft) * CONFIG.worker.score.timeBonus;
  G.score += bonus;
  G.clearBonus = bonus;
  Input.releaseAll();
  Sound.stopBgm();
  Sound.sfx.clear();
  UI.show('hint', false);
  UI.banner('ステージクリア!');
  const s = loadSave();
  s.cleared = Math.max(s.cleared || 0, G.stage + 1);
  saveSave(s);
}

function showResult() {
  const e = UI.el;
  const cleared = G.state === 'clear';
  const reason = G.over && G.over.reason;
  // 通しのスコア: ステージごとの最新のスコアを足す(やり直しても二重に足さない)
  G.stageScores = G.stageScores || [];
  G.stageScores[G.stage] = G.score;
  let total = 0; for (let i = 0; i <= G.stage; i++) total += G.stageScores[i] || 0;
  const last = G.stage === CONFIG.stages.length - 1;
  const s = loadSave();
  s.best = s.best || {};
  const prevBest = s.best[G.diffKey] || 0;
  const isBest = total > prevBest;
  if (isBest) { s.best[G.diffKey] = total; saveSave(s); }
  e.resTitle.textContent = cleared ? (last ? '全ステージクリア!!' : 'ステージ' + (G.stage + 1) + ' クリア!') : reason === 'time' ? 'タイムアップ…' : 'ダウン…';
  const ranks = [[9000, 'S', '工場の しずかな ヒーロー!'], [6000, 'A', 'お見事な ハリセンづかい!'], [3500, 'B', 'なかなかの パトロール!'], [0, 'C', 'つぎは もっと 見わけよう!']];
  let [, letter, msg] = ranks.find((r) => G.score >= r[0]);
  if (!cleared && letter === 'S') letter = 'A';
  if (G.stats.wrongHits === 0 && cleared) msg = 'まじめな人を ひとりも 叩かなかった! ' + msg;
  e.resRank.textContent = letter;
  e.resRank.style.background = letter === 'S' ? 'radial-gradient(circle at 35% 30%, #fff6a0, #ff5fb0)' : letter === 'A' ? 'radial-gradient(circle at 35% 30%, #ffe98a, #ff9d2e)' : letter === 'B' ? 'radial-gradient(circle at 35% 30%, #c8f5b0, #43c06a)' : 'radial-gradient(circle at 35% 30%, #d8e6ff, #7a9be0)';
  e.resMsg.textContent = msg;
  e.resScore.textContent = G.score.toLocaleString('en-US');
  e.resNew.classList.toggle('hidden', !isBest || total === 0);
  const st = G.stats;
  const rows = [['ハリセン ヒット', st.hits + st.bossHits + '発'], ['改心させた', st.reforms + '人'], ['また サボりだした', st.relapses + '人'], ['まじめな人を 叩いた', st.wrongHits + '回'], ['さいだいコンボ', st.bestCombo], ['おばさん', st.boss ? '改心させた!' : st.bossSeen ? 'にがした…' : 'まだ 来ていない'], ['おばさんを めまいに', st.bossStuns + '回'], ['ひろった ハリセン', st.pickups + '本'], ['逆ギレされた', st.retaliates + '回']];
  if (cleared) rows.unshift(['タイムボーナス', '+' + G.clearBonus]);
  if (G.stage > 0 || cleared) rows.push(['通しの スコア', total.toLocaleString('en-US')]);
  e.resStats.innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
  e.btnNext.classList.toggle('hidden', !(cleared && !last));
  e.btnRetry.textContent = cleared ? (last ? 'もういちど さいしょから' : 'このステージを もういちど') : 'もういちど!';
  e.bestTitle.textContent = Math.max(prevBest, total).toLocaleString('en-US');
  UI.show('result', true);
}

function refreshTitle() {
  document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('on', b.dataset.diff === G.diffKey));
  const cl = clearedStages();
  document.querySelectorAll('[data-stage]').forEach((b) => { const n = +b.dataset.stage; b.classList.toggle('on', G.selStage === n); b.classList.toggle('lock', n > cl); });
  UI.el.bestTitle.textContent = bestFor(G.diffKey).toLocaleString('en-US');
  UI.el.whackBestTitle.textContent = whackBest().toLocaleString('en-US');
}
// ---------- おばさんたたき ----------
function startWhack() {
  Sound.init();
  if (G.state === 'whack') Whack.stop();
  G.state = 'whack'; G.paused = false;
  G.diff = CONFIG.diff[G.diffKey];
  UI.last = {};
  for (const id of ['title', 'pause', 'result', 'howto', 'hud', 'hint']) UI.show(id, false);
  Input.releaseAll();
  Render.resize(true);
  Whack.start();
  requestWakeLock();
  armBackGuard();
}
function whackBest() { try { return parseInt(localStorage.getItem('harisen_whack_best') || '0', 10) || 0; } catch (e) { return 0; } }

function toTitle() {
  Sound.stopBgm();
  if (G.state === 'whack') Whack.stop();
  G.state = 'title'; G.paused = false;
  G.diff = CONFIG.diff[G.diffKey];
  G.stage = G.selStage;
  resetGame();
  G.cam.x = G.world.W / 2; G.cam.y = G.world.H / 2;
  UI.show('hud', false); UI.show('pause', false); UI.show('result', false); UI.show('hint', false); UI.show('howto', false);
  UI.show('title', true);
  G.dispScore = 0;
  refreshTitle();
}
function setPaused(p) {
  if (G.state !== 'playing' && G.state !== 'whack') return;
  G.paused = p;
  Whack.S.paused = p && G.state === 'whack';
  UI.show('pause', p);
  if (p) Input.releaseAll();
  else { $('pauseMsg').classList.add('hidden'); armBackGuard(); }
}
// 画面のはしの操作などで止めたときは、なぜ止まったかをポーズ画面に書く
function pauseFor(reason) {
  if (G.state !== 'playing' && G.state !== 'whack') return;
  if (G.state === 'whack' && Whack.S.phase !== 'play') return;
  const msg = $('pauseMsg');
  if (reason === 'back') msg.innerHTML = '画面の はしを さわって 「もどる」に なりかけたので<br>とめました。<b>「つづける」</b>で そのまま あそべます';
  else msg.innerHTML = 'ゲームの 画面が うしろに かくれたので とめました。<br><b>「つづける」</b>で そのまま あそべます';
  msg.classList.remove('hidden');
  setPaused(true);
}

// ---------- 「戻る」対策 ----------
// ゲーム中は ブラウザの履歴に 目印を1つ積んでおく。端をさわって「戻る」になっても、
// その目印が消えるだけで ページは このまま。ゲームを止めて、次にさわったときに 目印を積みなおす。
// (ブラウザは さわっていないときに積んだ目印を「戻る」で飛ばすことがあるので、積むのは必ず さわったとき)
let backGuardArmed = false;
function armBackGuard() {
  if (backGuardArmed || G.state === 'title') return;
  try { history.pushState({ harisen: 1 }, ''); backGuardArmed = true; } catch (e) { /* 使えない場所では なにもしない */ }
}
function setupBackGuard() {
  window.addEventListener('popstate', () => {
    if (!backGuardArmed) return;
    backGuardArmed = false;
    if (G.state === 'title') return; // タイトルでは ふつうに戻れる
    Input.releaseAll();
    pauseFor('back');
  });
  // さわったとき・キーを押したときに、目印が消えていたら積みなおす
  const rearm = () => { if (!backGuardArmed && G.state !== 'title') armBackGuard(); };
  window.addEventListener('pointerup', rearm, true);
  window.addEventListener('keydown', rearm, true);
}

// ---------- スマホ向けの補助 ----------
// 画面のはしをさわったら、はしが「さわらない場所」だと 一瞬ひからせて知らせる
let edgeTimer = 0;
function showEdgeGuard() {
  if (G.state !== 'playing') return;
  document.body.classList.add('edge-flash');
  clearTimeout(edgeTimer);
  edgeTimer = setTimeout(() => document.body.classList.remove('edge-flash'), 700);
  if (!G.edgeTold) { G.edgeTold = true; UI.toast('画面の いちばん はしは スマホの「もどる」に なりやすいので、すこし 内がわを さわってね', 3400); }
}
let wakeLock = null;
function requestWakeLock() {
  try {
    if (!navigator.wakeLock || document.hidden || wakeLock) return;
    navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => { /* 許可されなくても遊べる */ });
  } catch (e) { /* 無視 */ }
}
const perf = { ema: 1 / 60, next: 0, lowered: 0 };
function watchPerformance(rawDt, now) {
  if (G.paused || G.state === 'title' || rawDt <= 0 || rawDt > 0.25) return;
  perf.ema = perf.ema * 0.94 + rawDt * 0.06;
  if (now < perf.next) return;
  if (perf.ema > 0.027) { if (Render.lowerQuality()) perf.lowered++; perf.ema = 1 / 60; perf.next = now + 3; }
}

// ---------- カメラ ----------
function updateCamera(dt) {
  const V = G.view;
  const P = G.player;
  const C = G.cam;
  const W = G.world;
  let tx; let ty;
  if (G.state === 'title') {
    // タイトルでは工場をゆっくり見まわす
    tx = W.W / 2 + Math.sin(G.clock * 0.12) * (W.W * 0.3); ty = W.H / 2 + Math.cos(G.clock * 0.09) * (W.H * 0.25);
  } else {
    tx = P.x + Math.cos(P.aim) * 24; ty = P.y - 46 + Math.sin(P.aim) * 16;
    if (G.boss && G.bossIntro > 0) { const k = clamp(G.bossIntro / 2.6, 0, 1); tx = lerp(tx, G.boss.x, k); ty = lerp(ty, G.boss.y, k); }
  }
  const k = 1 - Math.exp(-(G.state === 'title' ? 1.5 : 7) * dt);
  C.x += (tx - C.x) * k; C.y += (ty - C.y) * k;
  C.x = clamp(C.x, V.vw / 2, W.W - V.vw / 2);
  C.y = clamp(C.y, V.vh / 2, W.H - V.vh / 2);
  C.shake = Math.max(0, C.shake - dt * 40);
  const kf = Math.exp(-14 * dt);
  C.kx = (C.kx || 0) * kf; C.ky = (C.ky || 0) * kf;
  V.left = C.x + C.kx - V.vw / 2; V.top = C.y + C.ky - V.vh / 2;
}

// ---------- 1ステップ進める ----------
function step(h) {
  if (G.state === 'whack') { Whack.update(h); return; }
  if (G.state === 'title') {
    // タイトルの裏では作業員が勝手に動いている(デモ)
    for (const w of G.workers) updateWorker(w, h);
    updateFx(h);
  } else {
    updateGame(h);
    if (G.state === 'over' || G.state === 'clear') {
      G.overT += h;
      if (G.overT > 1.5 && UI.el.result.classList.contains('hidden')) showResult();
    }
  }
  updateCamera(h);
}

let lastTs = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const now = ts / 1000;
  const rawDt = now - lastTs;
  const dt = Math.min(Math.max(rawDt, 0), 0.1);
  lastTs = now;
  if (lastTs > 0 && rawDt < 1) watchPerformance(rawDt, now);
  if (!G.paused) {
    G.clock += dt;
    let scale = 1;
    if (G.hitStop > 0) { G.hitStop -= dt; scale = 0.1; }
    let rem = dt * scale;
    while (rem > 1e-6) { const h = Math.min(rem, 1 / 60); step(h); rem -= h; }
  }
  if (G.state === 'whack') { Whack.draw(G.clock); Whack.updateHud(); return; }
  Render.draw(G.clock);
  if (G.state !== 'title') { Render.drawMini(); UI.updateHud(); }
}

// ---------- タイトル・あそびかたの絵 ----------
function drawLegendPics() {
  const draw = (id, fn) => { const c = $(id); if (!c) return; const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.scale(c.width / 100, c.height / 100); fn(g); };
  // 目元くらべ
  draw('eyeGood', (g) => { g.translate(50, 54); g.scale(2.6, 2.6); Art.drawHoodHead(g, { r: 14, face: 1, eyes: { mean: 0, look: { x: 0, y: 0.2 } }, blush: true }); });
  draw('eyeBad', (g) => { g.translate(50, 54); g.scale(2.6, 2.6); Art.drawHoodHead(g, { r: 14, face: 1, eyes: { mean: 1, grin: true, look: { x: 0.6, y: 0.1 }, smirk: 1, vein: true } }); });
  draw('eyeBoss', (g) => { g.translate(50, 56); g.scale(1.3, 1.3); Art.drawTone(g, 30, 0.5, 0); Art.drawHoodHead(g, { r: 30, face: 1, perm: true, mask: '#ffe4ec', skin: '#f3cfae', eyes: { mean: 1, grin: true, look: { x: 0.5, y: 0.2 }, size: 2.1, lashes: true, bags: true, wrinkles: true, browThick: 2.1 } }); });
  const fake = (kind, pose, extra) => ({ face: 1, walkT: 0, moving: false, pose, t: 0.5, eyes: Object.assign({ mean: kind === 'good' ? 0 : 1, grin: kind !== 'good' }, extra || {}), blush: kind === 'good', badge: '#4fa4e8', veg: 'hakusai', workKind: 'chop' });
  draw('ic-good', (g) => { g.translate(50, 92); g.scale(1.2, 1.2); Art.drawWorker(g, fake('good', 'work')); });
  draw('ic-slacker', (g) => { g.translate(50, 92); g.scale(1.2, 1.2); Art.drawWorker(g, fake('slacker', 'phone', { droop: 0.6, look: { x: 0, y: 0.9 } })); });
  draw('ic-gossip', (g) => { g.translate(32, 92); g.scale(1.05, 1.05); Art.drawWorker(g, fake('gossip', 'gossip', { smirk: 1, look: { x: 0.9, y: 0.1 } })); g.translate(34, 0); g.scale(-1, 1); Art.drawWorker(g, fake('gossip', 'gossip', { smirk: 1, look: { x: 0.9, y: 0.1 } })); });
  draw('ic-sabo', (g) => { g.translate(46, 92); g.scale(1.2, 1.2); Art.drawWorker(g, fake('sabo', 'bother', { vein: true, look: { x: 1, y: 0 } })); });
  draw('ic-boss', (g) => { g.translate(50, 96); g.scale(0.6, 0.6); Art.drawBoss(g, { face: 1, state: 'seek', moving: false, walkT: 0, level: 1, look: { x: 0.6, y: 0.2 }, hitFlash: 0 }, 0.3); });
  draw('ic-harisen', (g) => { g.translate(16, 60); g.rotate(-0.45); Art.drawHarisen(g, 'normal', 0.9); g.translate(0, 26); Art.drawHarisen(g, 'jumbo', 0.72); g.translate(0, 26); Art.drawHarisen(g, 'spark', 0.9); });
}

// ---------- 起動 ----------
function boot() {
  G.canvas = $('game');
  G.ctx = G.canvas.getContext('2d', { alpha: false });
  G.mini = $('minimap');
  G.cam = { x: 0, y: 0, shake: 0, kx: 0, ky: 0 };
  G.view = { left: 0, top: 0 };
  G.clock = 0; G.paused = false; G.state = 'title'; G.dispScore = 0;
  const sv = loadSave();
  G.diffKey = CONFIG.diff[sv.diff] ? sv.diff : 'normal';
  G.selStage = 0;
  G.diff = CONFIG.diff[G.diffKey];
  G.stage = 0;
  UI.init();
  Render.resize();
  resetGame();
  Render.buildMini();
  G.cam.x = G.world.W / 2; G.cam.y = G.world.H / 2;
  drawLegendPics();

  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;
  if (mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(any-pointer: fine)'))) document.body.classList.add('touch');
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') document.body.classList.add('touch'); }, true);
  Input.attach(G.canvas, $('stickL'), $('stickR'), {
    onKey(code) {
      if (code === 'KeyP' || code === 'Escape') { if (G.state === 'playing') setPaused(!G.paused); }
      else if (code === 'KeyM') toggleMute();
      else if (code === 'Enter') {
        if (G.state === 'whack') { if (Whack.S.phase === 'result') startWhack(); else if (G.paused) setPaused(false); }
        else if (G.state === 'title') startGame(G.selStage);
        else if (!UI.el.result.classList.contains('hidden')) { if (!UI.el.btnNext.classList.contains('hidden')) startGame(G.stage + 1); else startGame(G.state === 'clear' ? 0 : G.stage); }
        else if (G.paused) setPaused(false);
      }
    },
    onStick(side) { UI.el[side === 'L' ? 'thL' : 'thR'].classList.add('gone'); },
    onEdge() { showEdgeGuard(); },
    onTap(x, y) { return G.state === 'whack' ? Whack.tap(x, y) : false; },
    onFirstInput() { Sound.init(); if (Input.isTouch()) document.body.classList.add('touch'); },
  });

  UI.el.btnStart.addEventListener('click', () => startGame(G.selStage));
  UI.el.btnWhack.addEventListener('click', startWhack);
  UI.el.btnWhackAgain.addEventListener('click', startWhack);
  UI.el.btnWhackTitle.addEventListener('click', toTitle);
  UI.el.btnRetry.addEventListener('click', () => startGame(G.state === 'clear' && G.stage === CONFIG.stages.length - 1 ? 0 : G.stage));
  UI.el.btnNext.addEventListener('click', () => startGame(G.stage + 1));
  UI.el.btnToTitle.addEventListener('click', toTitle);
  UI.el.btnResume.addEventListener('click', () => setPaused(false));
  UI.el.btnQuit.addEventListener('click', toTitle);
  UI.el.btnHowto.addEventListener('click', () => { Sound.init(); Sound.sfx.click(); UI.show('howto', true); });
  UI.el.btnHowtoClose.addEventListener('click', () => { Sound.sfx.click(); UI.show('howto', false); });
  UI.el.btnPause.addEventListener('click', (e) => { setPaused(!G.paused); e.currentTarget.blur(); });
  UI.el.btnSound.addEventListener('click', (e) => { toggleMute(); e.currentTarget.blur(); });
  const syncMute = () => UI.el.btnSound.classList.toggle('muted', Sound.isMuted());
  function toggleMute() { Sound.init(); Sound.setMuted(!Sound.isMuted()); syncMute(); }
  syncMute();
  document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    Sound.init(); Sound.sfx.click();
    G.diffKey = b.dataset.diff; G.diff = CONFIG.diff[G.diffKey];
    const s = loadSave(); s.diff = G.diffKey; saveSave(s);
    refreshTitle();
  }));
  document.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => {
    Sound.init();
    const n = +b.dataset.stage;
    if (n > clearedStages()) { UI.toast('まえの ステージを クリアすると あそべるよ', 2400); return; }
    Sound.sfx.click();
    G.selStage = n; G.stage = n;
    resetGame(); Render.buildMini();
    G.cam.x = G.world.W / 2; G.cam.y = G.world.H / 2;
    refreshTitle();
  }));
  refreshTitle();

  // スマホのツールバーの出入りで 何度も続けて大きさが変わるので、落ち着いてから1回だけ合わせる
  let resizeTimer = 0;
  const queueResize = (ms) => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { Render.resize(); if (G.state === 'whack') Whack.resize(); }, ms); };
  window.addEventListener('resize', () => queueResize(150));
  window.addEventListener('orientationchange', () => queueResize(300));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseFor('hidden'); else { if (G.state === 'playing') requestWakeLock(); Sound.init(); } });
  window.addEventListener('blur', () => pauseFor('hidden'));
  // 「戻る」をしたあと、ページがそのまま戻ってきた(前に進む・アプリにもどる)とき
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lastTs = 0; Input.releaseAll(); pauseFor('hidden'); queueResize(50); } });
  setupBackGuard();

  // 動作確認用: URL に ?debug を付けるとコンソールから状態を触れる
  if (/[?&]debug/.test(location.search)) window.__harisen = { G, CONFIG, perf, Art, Render, Whack, startWhack, workerEyes, workerPose, startGame, endGame, stageClear, resetGame, setPaused, step, swing, hitWorker, hitBoss, spawnBoss, reform, relapse, makeWorker, moveBody, findPath, toTitle, showResult, Sound, Input };

  requestAnimationFrame(loop);
  // ホーム画面に追加・オフラインで起動できるように(https で公開したときだけ)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* 無視 */ } });
  }
}

boot();
