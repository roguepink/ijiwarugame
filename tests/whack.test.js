'use strict';
/* NODE_PATH=$(npm root -g) node tests/whack.test.js — 「おばさんたたき」を Chromium で通しプレイする:
   タイトルから入れる → 5種類・いろいろな出方で出てくる → 連打しても時間がちゃんと進む → 60秒で終わり → 結果にぜんぶ並ぶ → もういちど/タイトルへ */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html') + '?debug'); await page.waitForTimeout(500);
  let ok = true; const check = (name, cond, extra) => { console.log((cond ? '  ok  ' : '  NG  ') + name + (extra ? '  ' + extra : '')); if (!cond) ok = false; };
  await page.click('#btnWhack', { force: true }); await page.waitForTimeout(100);
  check('タイトルの ボタンから 入れる', await page.evaluate(() => window.__harisen.G.state === 'whack'));
  const r = await page.evaluate(() => {
    const H = window.__harisen; const W = H.Whack; const S = W.S;
    const sc = window.innerWidth / 1280;
    for (let i = 0; i < 80; i++) H.step(1 / 60);
    // 5種類 × 出方
    const seenTypes = new Set(); const seenStyles = new Set();
    let steps = 0; let taps = 0; const t0 = S.timeLeft;
    while (S.phase === 'play' && steps < 60 * 75) {
      for (const m of W.moles()) { seenTypes.add(m.type.id); seenStyles.add(m.style); }
      const ms = W.moles().filter((m) => m.phase !== 'gone' && m.rise > 0.3 && !m.sorry);
      if (ms.length) { const m = ms[ms.length - 1]; const q = W.pose(m); W.tap(q.hx * sc, q.hy * sc); W.tap(q.hx * sc + 3, q.hy * sc); taps += 2; } // 1フレームに2回 連打
      H.step(1 / 60); steps++;
    }
    const secs = steps / 60;
    for (let i = 0; i < 60 * 6; i++) H.step(1 / 60);
    const dup = S.sorry.length !== new Set(S.sorry).size;
    return { secs, taps, phase: S.phase, sorry: S.sorry.length, hits: S.hits, types: [...seenTypes], styles: [...seenStyles], dup, resultShown: !document.getElementById('whackResult').classList.contains('hidden'), title: document.getElementById('wrTitle').textContent, t0 };
  });
  check('連打しつづけても 60秒で ちゃんと終わる', r.phase === 'result' && r.secs > 58 && r.secs < 64, Math.round(r.secs) + '秒 / ' + r.taps + '回たたいた');
  check('5種類 ぜんぶ 出てきた', r.types.length === 5, r.types.join(','));
  check('いろいろな出方(6種類)で 出てきた', ['up', 'peek', 'down', 'side', 'box', 'poof'].every((s) => r.styles.includes(s)), r.styles.join(','));
  check('たくさん あやまらせた', r.sorry >= 40 && r.hits >= 200, r.sorry + '人 / ' + r.hits + '発');
  check('同じ人を 二重に 数えていない', !r.dup);
  check('結果が 出て、人数が 見出しに', r.resultShown && r.title.includes(r.sorry + '人'), r.title);
  await page.click('#btnWhackAgain', { force: true }); await page.waitForTimeout(100);
  check('もういちど で はじめから', await page.evaluate(() => window.__harisen.Whack.S.phase === 'intro'));
  await page.evaluate(() => window.__harisen.toTitle());
  check('タイトルへ もどれる', await page.evaluate(() => window.__harisen.G.state === 'title' && document.getElementById('whackHud').classList.contains('hidden')));
  await browser.close();
  if (errors.length) { console.error('NG', errors.join('\n')); process.exit(1); }
  if (!ok) process.exit(1);
  console.log('\nおばさんたたきのテスト 通過');
})();
