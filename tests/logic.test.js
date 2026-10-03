'use strict';
/* node tests/logic.test.js で実行。ブラウザなしで、ルール・当たり判定・マップの正しさを確かめる */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ console, Math, Uint8Array, Int32Array, Map, Set, Infinity, Date });
for (const f of ['util', 'config', 'world']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}
const $ = (expr) => vm.runInContext(expr, ctx);

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  NG  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

test('コンボ倍率: 1コンボ目は等倍、増えるほど上がり、x3で頭打ち', () => {
  assert.strictEqual($('comboMultiplier(1)'), 1);
  assert.strictEqual($('comboMultiplier(2)'), 1.25);
  assert.strictEqual($('comboMultiplier(5)'), 2);
  assert.strictEqual($('comboMultiplier(50)'), 3);
});

test('ハリセンの扇形: 正面の近い相手に当たり、うしろや遠くには当たらない', () => {
  const arc = (130 * Math.PI) / 180;
  assert.ok($(`inSwingArc(0, 0, 0, 72, ${arc}, 50, 0, 15)`), '正面');
  assert.ok($(`inSwingArc(0, 0, 0, 72, ${arc}, 40, 30, 15)`), 'ななめ前');
  assert.ok(!$(`inSwingArc(0, 0, 0, 72, ${arc}, -50, 0, 15)`), 'うしろ');
  assert.ok(!$(`inSwingArc(0, 0, 0, 72, ${arc}, 120, 0, 15)`), '遠い');
  assert.ok($(`inSwingArc(0, 0, 0, 72, ${arc}, -5, 5, 15)`), '密着していれば向きを問わない');
});

test('円と矩形の押し出し: めりこんだぶんだけ外へ出る', () => {
  const p = $('circleRectPush(5, 50, 15, {x: 10, y: 0, w: 100, h: 100})');
  assert.ok(p.x < -9 && Math.abs(p.y) < 1e-9, JSON.stringify(p));
  assert.strictEqual($('circleRectPush(-30, 50, 15, {x: 10, y: 0, w: 100, h: 100})'), null);
  const inside = $('circleRectPush(12, 50, 15, {x: 10, y: 0, w: 100, h: 100})');
  assert.ok(inside.x < -15, '中心が中にあれば近い辺へ出す');
});

test('線分と矩形: 交わる/交わらない', () => {
  assert.ok($('segmentHitsRect(0, 50, 200, 50, {x: 50, y: 0, w: 50, h: 100}, 0)'));
  assert.ok(!$('segmentHitsRect(0, 150, 200, 150, {x: 50, y: 0, w: 50, h: 100}, 0)'));
  assert.ok($('segmentHitsRect(0, 110, 200, 110, {x: 50, y: 0, w: 50, h: 100}, 15)'), '余白ぶん広げる');
});

test('幅優先の経路: 壁をまわりこんで着く。ふさがれていれば null', () => {
  const w = 5; const h = 5;
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < 4; y++) blocked[y * w + 2] = 1; // 真ん中に縦の壁(下だけ空いている)
  const p = $('bfsPath')(blocked, w, h, 0, 0, 4, 0);
  assert.ok(p && p.length >= 10, 'まわりこむ');
  assert.deepStrictEqual(Array.from(p[p.length - 1]), [4, 0]);
  blocked[4 * w + 2] = 1;
  assert.strictEqual($('bfsPath')(blocked, w, h, 0, 0, 4, 0), null);
});

for (let s = 0; s < 3; s++) {
  test(`ステージ${s + 1}: マップが毎回同じに作られ、台・サボり場所・搬入口へ歩いて行ける`, () => {
    const a = $(`buildWorld(${s}, 123)`);
    const b = $(`buildWorld(${s}, 123)`);
    assert.strictEqual(a.rects.length, b.rects.length);
    assert.deepStrictEqual(a.rects.map((r) => [r.x, r.y, r.w, r.h]), b.rects.map((r) => [r.x, r.y, r.w, r.h]));
    const ok = (x, y) => { const cx = Math.floor(x / a.T); const cy = Math.floor(y / a.T); return !!a.reach[cy * a.gw + cx]; };
    assert.ok(a.stations.length >= 30, '作業台が十分ある: ' + a.stations.length);
    assert.ok(a.stations.every((st) => ok(st.sx, st.sy)), '全ての作業台の立ち位置に行ける');
    assert.ok(a.spots.every((p) => ok(p.x, p.y)), 'サボり場所に行ける');
    assert.ok(a.gossipSpots.every((p) => ok(p.x, p.y)), '悪口コンビの場所に行ける');
    assert.ok(ok(a.dock.x, a.dock.y + 50), '搬入口に行ける');
    assert.ok(a.spots.length >= CONFIG_bad(s), 'サボり場所が足りる');
    // 立ち位置が障害物にめりこんでいない
    for (const st of a.stations) for (const r of a.rects) assert.ok(!$('pointInRect')(st.sx, st.sy, r, 10), '作業台の立ち位置が障害物に重なる');
    // 経路が引ける
    const p = $('findPath')(a, a.start.x, a.start.y, a.dock.x, a.dock.y + 50);
    assert.ok(p && p.length > 0, 'スタートから搬入口へ経路が引ける');
    assert.ok(a.freeCells.length > 1000, '歩けるセルが十分ある');
  });
}
function CONFIG_bad(s) { return $(`CONFIG.stages[${s}].bad.slacker`) + 1; }

test('難易度ごとの設定がそろっている', () => {
  for (const k of ['easy', 'normal', 'hard']) {
    const d = $(`CONFIG.diff.${k}`);
    assert.ok(d.time > 0 && d.needReform.length === 3 && d.cue >= 0 && d.cue <= 2, k);
  }
  assert.strictEqual($('CONFIG.stages.length'), 3);
  assert.deepStrictEqual(Object.keys($('CONFIG.harisen')), ['normal', 'jumbo', 'spark']);
});

if (!process.exitCode) console.log('\nロジックのテスト 通過 (' + passed + ')');
