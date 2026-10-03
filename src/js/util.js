'use strict';
/* 共通ユーティリティ。DOMに依存しない純粋関数だけを置く(node でテストできるように) */

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, to, step) => (v < to ? Math.min(v + step, to) : Math.max(v - step, to));
const angleDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
};
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// シード付き乱数。マップ生成を毎回同じにするために使う
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// コンボ数(1以上)→スコア倍率。1コンボ増えるごとに +0.25、最大 x3
function comboMultiplier(combo) {
  return Math.min(1 + 0.25 * Math.max(combo - 1, 0), 3);
}

// 点が矩形 {x,y,w,h} の中か(margin だけ広げて判定)
function pointInRect(px, py, r, margin) {
  const m = margin || 0;
  return px >= r.x - m && px <= r.x + r.w + m && py >= r.y - m && py <= r.y + r.h + m;
}
function rectsOverlap(a, b, margin) {
  const m = margin || 0;
  return a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
}

// 円(x,y,r)を矩形から押し出す。動かした量を返す(動かさなければ null)
function circleRectPush(cx, cy, r, rc) {
  const nx = clamp(cx, rc.x, rc.x + rc.w);
  const ny = clamp(cy, rc.y, rc.y + rc.h);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 < 1e-9) {
    // 中心が矩形の内側: いちばん近い辺へ出す
    const l = cx - rc.x; const rr = rc.x + rc.w - cx; const t = cy - rc.y; const b = rc.y + rc.h - cy;
    const m = Math.min(l, rr, t, b);
    if (m === l) return { x: -(l + r), y: 0 };
    if (m === rr) return { x: rr + r, y: 0 };
    if (m === t) return { x: 0, y: -(t + r) };
    return { x: 0, y: b + r };
  }
  const d = Math.sqrt(d2);
  const k = (r - d) / d;
  return { x: dx * k, y: dy * k };
}

// 線分 a-b が矩形(margin だけ広げた)と交わるか
function segmentHitsRect(ax, ay, bx, by, rc, margin) {
  const m = margin || 0;
  const x0 = rc.x - m; const y0 = rc.y - m; const x1 = rc.x + rc.w + m; const y1 = rc.y + rc.h + m;
  let t0 = 0; let t1 = 1;
  const dx = bx - ax; const dy = by - ay;
  const clip = (p, q) => { // p*t <= q
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay);
}

// 4近傍の塗りつぶし。blocked が 1 のセルは通れない。戻り値は到達できたセルが 1 の配列
function floodFill(blocked, w, h, sx, sy) {
  const reach = new Uint8Array(w * h);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || blocked[sy * w + sx]) return reach;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  queue[tail++] = sy * w + sx;
  reach[sy * w + sx] = 1;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0 && !reach[i - 1] && !blocked[i - 1]) { reach[i - 1] = 1; queue[tail++] = i - 1; }
    if (x < w - 1 && !reach[i + 1] && !blocked[i + 1]) { reach[i + 1] = 1; queue[tail++] = i + 1; }
    if (y > 0 && !reach[i - w] && !blocked[i - w]) { reach[i - w] = 1; queue[tail++] = i - w; }
    if (y < h - 1 && !reach[i + w] && !blocked[i + w]) { reach[i + w] = 1; queue[tail++] = i + w; }
  }
  return reach;
}

// 幅優先でセル列の経路を求める(4近傍)。見つからなければ null。戻り値は [ [cx,cy], ... ](始点を含まない)
function bfsPath(blocked, w, h, sx, sy, gx, gy) {
  if (sx === gx && sy === gy) return [];
  if (gx < 0 || gy < 0 || gx >= w || gy >= h || blocked[gy * w + gx]) return null;
  const prev = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const start = sy * w + sx;
  const goal = gy * w + gx;
  queue[tail++] = start;
  prev[start] = start;
  while (head < tail) {
    const i = queue[head++];
    if (i === goal) break;
    const x = i % w;
    const y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const n of nb) {
      if (n < 0 || prev[n] !== -1 || blocked[n]) continue;
      prev[n] = i; queue[tail++] = n;
    }
  }
  if (prev[goal] === -1) return null;
  const out = [];
  for (let i = goal; i !== start; i = prev[i]) out.push([i % w, (i / w) | 0]);
  out.reverse();
  return out;
}

// ハリセンの当たり判定: 中心(px,py)、向き aim、半径 range、開き角 arc(ラジアン全体)の扇形に、点(tx,ty,半径 tr)が入っているか
function inSwingArc(px, py, aim, range, arc, tx, ty, tr) {
  const d = Math.hypot(tx - px, ty - py);
  if (d - tr > range) return false;
  if (d < tr + 6) return true; // 密着しているときは向きを問わない
  const a = Math.atan2(ty - py, tx - px);
  const half = arc / 2 + Math.asin(Math.min(1, tr / Math.max(d, 1)));
  return Math.abs(angleDiff(aim, a)) <= half;
}
