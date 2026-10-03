'use strict';
/* node tests/browser.test.js — プリインストールの Chromium(Playwright)で index.html を開き、
   例外なしで起動 → ボットで通しプレイ(悪い人を探して叩き、ボスを倒してクリア) → 結果画面まで進むことを確かめる。
   playwright が見つからないときは NODE_PATH=$(npm root -g) を付けて実行する */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?debug');
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const H = window.__harisen; const G = H.G;
    const bot = { mv: { x: 0, y: 0 }, aim: 0, fire: false };
    H.Input.move = () => bot.mv;
    H.Input.aim = () => ({ angle: bot.aim, fire: bot.fire, touch: false });
    H.startGame(0);
    let path = null; let pathI = 0; let tgtId = null; let repathT = 0;
    const dt = 1 / 60;
    let steps = 0;
    while (G.state === 'playing' && steps < 60 * 300) {
      const P = G.player;
      let tgt = null;
      if (G.boss && !G.boss.dead && G.boss.state !== 'defeated') tgt = G.boss;
      else { let bd = 1e18; for (const w of G.workers) { if (w.kind === 'good' || w.state === 'bow') continue; const d = (w.x - P.x) ** 2 + (w.y - P.y) ** 2; if (d < bd) { bd = d; tgt = w; } } }
      bot.fire = false; bot.mv = { x: 0, y: 0 };
      if (tgt) {
        const d = Math.hypot(tgt.x - P.x, tgt.y - P.y);
        if (d > (tgt === G.boss ? 85 : 60)) {
          repathT -= dt;
          if (tgtId !== (tgt.id || 'boss') || !path || repathT <= 0) { path = H.findPath(G.world, P.x, P.y, tgt.x, tgt.y) || [{ x: tgt.x, y: tgt.y }]; pathI = 0; tgtId = tgt.id || 'boss'; repathT = 0.8; }
          while (pathI < path.length - 1 && Math.hypot(path[pathI].x - P.x, path[pathI].y - P.y) < 10) pathI++;
          const q = path[Math.min(pathI, path.length - 1)];
          const dx = q.x - P.x; const dy = q.y - P.y; const l = Math.hypot(dx, dy) || 1;
          bot.mv = { x: dx / l, y: dy / l }; bot.aim = Math.atan2(dy, dx);
        } else { bot.aim = Math.atan2(tgt.y - 10 - P.y, tgt.x - P.x); bot.fire = true; }
        if (G.boss && G.boss.state === 'windup' && Math.hypot(G.boss.x - P.x, G.boss.y - P.y) < 200) { const ax = P.x - G.boss.x; const ay = P.y - G.boss.y; const al = Math.hypot(ax, ay) || 1; bot.mv = { x: ax / al, y: ay / al }; bot.fire = false; }
      }
      H.step(dt); steps++;
      if (![P.x, P.y, G.score].every(Number.isFinite)) return { nan: true };
    }
    for (let i = 0; i < 200; i++) H.step(dt);
    return { state: G.state, score: G.score, reforms: G.stats.reforms, wrong: G.stats.wrongHits, boss: G.stats.boss, sec: Math.round(steps / 60), result: !document.getElementById('result').classList.contains('hidden') };
  });
  await browser.close();
  console.log(JSON.stringify(res));
  let ok = errors.length === 0 && !res.nan && res.state === 'clear' && res.boss && res.result && res.wrong === 0;
  if (!ok) { console.error('NG', errors.join('\n')); process.exit(1); }
  console.log('\nブラウザのテスト 通過 (ステージ1を ' + res.sec + ' 秒でクリア、まじめな人を叩いた回数 ' + res.wrong + ')');
})();
