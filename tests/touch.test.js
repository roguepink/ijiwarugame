'use strict';
/* NODE_PATH=$(npm root -g) node tests/touch.test.js — スマホの画面(横向き・タッチ)で、はしの操作に強いかを確かめる:
   指の「はなした」が届かないとき・はしのタッチ・画面の大きさの変化・ブラウザの「戻る」 */

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('about:blank');
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?debug'); await p.waitForTimeout(600);
  await p.tap('#btnStart', { force: true }); await p.waitForTimeout(400);
  const H = (fn, a) => p.evaluate(fn, a);
  const ptr = (type, id, x, y) => H(({ type, id, x, y }) => { document.getElementById('game').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); }, { type, id, x, y });
  const step = (n) => H((n) => { for (let i = 0; i < n; i++) window.__harisen.step(1 / 60); }, n);
  const pos = () => H(() => [window.__harisen.G.player.x, window.__harisen.G.player.y]);
  let ok = true; const check = (name, cond, extra) => { console.log((cond ? 'OK  ' : 'NG  ') + name + (extra ? ' ' + extra : '')); if (!cond) ok = false; };

  // 1: 横取りされた指(はなしたが届かない)のあと、新しい指で 反対向きに動かせる
  await ptr('pointerdown', 11, 60, 200); await ptr('pointermove', 11, 110, 200); // 右へ
  await step(10);
  await ptr('pointerdown', 12, 200, 250); await ptr('pointermove', 12, 150, 250); // 左へ
  const a = await pos(); await step(30); const c = await pos();
  check('1 横取りのあと 新しい指で左へ動ける', c[0] < a[0] - 40, `dx=${Math.round(c[0] - a[0])}`);
  // 2: 指がぜんぶ はなれたら(touchend 0本) 止まる
  await H(() => { const t = new TouchEvent('touchend', { touches: [], changedTouches: [], bubbles: true }); window.dispatchEvent(t); });
  const s2 = await H(() => window.__harisen.Input.sticks());
  const a2 = await pos(); await step(30); const c2 = await pos();
  check('2 指がぜんぶ はなれたら スティックを はなす', s2.L === null && s2.R === null && Math.hypot(c2[0] - a2[0], c2[1] - a2[1]) < 30, JSON.stringify(s2));
  // 3: 右がわが固まっても(ハリセンを振りつづける)、新しい指で止められる
  await ptr('pointerdown', 21, 700, 200); await step(20);
  const sw1 = await H(() => window.__harisen.G.stats.swings);
  await ptr('pointerdown', 22, 650, 220); await ptr('pointerup', 22, 650, 220);
  const sw2 = await H(() => window.__harisen.G.stats.swings); await step(40); const sw3 = await H(() => window.__harisen.G.stats.swings);
  check('3 右の指が固まっても 次の指で ハリセンが止まる', sw1 > 0 && sw3 === sw2, `${sw1}/${sw2}/${sw3}`);
  // 4: 画面のはし(22px)から始まるタッチは使わない
  await ptr('pointerdown', 31, 6, 200);
  const s4 = await H(() => window.__harisen.Input.sticks());
  check('4 はしのタッチは スティックにしない', s4.L === null, JSON.stringify(s4));
  await p.waitForTimeout(100); 
  // 5: 画面の大きさが何度も変わっても、絵の作り直しは1回(落ち着いてから)
  const t5 = await H(async () => {
    const R = window.__harisen.Art; let n = 0; const orig = R.init; R.init = function (sc) { n++; return orig.call(this, sc); };
    for (let i = 0; i < 12; i++) { window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 16)); }
    await new Promise((r) => setTimeout(r, 300)); R.init = orig; return n;
  });
  check('5 大きさの変化が続いても 描き直しは まとめて1回以下', t5 <= 1, `Art.init=${t5}`);
  // 6: 戻る → ページはそのまま、ポーズになる
  await p.goBack(); await p.waitForTimeout(400);
  const s6 = await H(() => ({ url: location.href.slice(-30), paused: window.__harisen.G.paused, msg: !document.getElementById('pauseMsg').classList.contains('hidden') }));
  check('6 戻る をしても ページに のこって ポーズ', /index\.html/.test(s6.url) && s6.paused && s6.msg, JSON.stringify(s6));
  
  // 7: つづける → 遊べる。もう一度 戻る → またポーズ(目印が積みなおされている)
  await p.tap('#btnResume', { force: true }); await p.waitForTimeout(200);
  const r7 = await H(() => window.__harisen.G.paused);
  await p.goBack(); await p.waitForTimeout(400);
  const s7 = await H(() => ({ url: location.href.slice(-30), paused: window.__harisen.G.paused }));
  check('7 つづけたあと もう一度 戻る でも ページに のこる', !r7 && /index\.html/.test(s7.url) && s7.paused, JSON.stringify(s7));
  // 8: タイトルにもどったら、戻る でふつうに前のページへ(閉じこめない)
  await p.tap('#btnQuit', { force: true }); await p.waitForTimeout(200);
  await p.goBack(); await p.waitForTimeout(300);
  await p.goBack().catch(() => {}); await p.waitForTimeout(400);
  check('8 タイトルからは 戻る で ページを はなれられる', p.url() === 'about:blank', p.url());
  console.log(errs.length ? 'ERR ' + errs.join('\n') : 'no page errors');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
