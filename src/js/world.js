'use strict';
/* 工場のマップを作る。ステージごとに まったく違う並び方にする:
     1 白菜ライン   : 横に流れるベルトが何本も(白とブルーグレーの衛生的なタイル)
     2 キャベツライン: 洗浄タンクから縦に流れるベルトが6本(ミントグリーンの床・水色の水槽・緑のコンテナ)
     3 出荷フロア   : コの字の長いコンベア・箱詰め台・背の高い棚・出荷口のシャッター(コンクリートの床・黄色い通路)
   すべて矩形の障害物(rects)で表し、歩ける場所は起動時に塗りつぶしで求める */

const WALL = 40;

function buildWorld(stageNo, seed) {
  const st = CONFIG.stages[stageNo];
  const rnd = mulberry32((seed || 1) + stageNo * 977);
  const L = { W: st.W, H: st.H, rects: [], belts: [], stations: [], spots: [], gossipSpots: [], props: [], rnd };
  L.add = (x, y, w, h, type, extra) => { const r = Object.assign({ x, y, w, h, type }, extra || {}); L.rects.push(r); return r; };
  // 外壁
  L.add(0, 0, L.W, WALL, 'wall'); L.add(0, L.H - WALL, L.W, WALL, 'wall'); L.add(0, 0, WALL, L.H, 'wall'); L.add(L.W - WALL, 0, WALL, L.H, 'wall');
  L.dock = { x: L.W / 2, y: WALL + 10, w: 220 }; // 搬入口(ボスが入ってくる)
  L.start = { x: L.W / 2, y: L.H - 130 };
  if (st.layout === 'columns') layoutColumns(L, st);
  else if (st.layout === 'warehouse') layoutWarehouse(L, st);
  else layoutRows(L, st);
  if (!L.props.some((p) => p.type === 'door')) L.props.push({ type: 'door', x: L.dock.x, y: WALL, w: L.dock.w, label: '搬入口' });
  L.props.push({ type: 'floorMark', x: L.start.x, y: L.H - 110, text: '入口' });
  return finishWorld(L, st, stageNo);
}

// 横のベルトの両側に作業台を並べる(すき間 gaps の前後はあける)
function addHBelt(L, x0, x1, y, gaps, line, veg, kind) {
  const BH = 36; const TH = 30; const TW = 58; const GAPW = 124;
  let x = x0;
  for (const gx of gaps) {
    if (gx - x > 30) { L.add(x, y - BH, gx - x, BH * 2, 'belt'); L.belts.push({ x, y: y - BH, w: gx - x, h: BH * 2, line, dir: 'h', veg }); }
    x = gx + GAPW;
  }
  if (x1 - x > 30) { L.add(x, y - BH, x1 - x, BH * 2, 'belt'); L.belts.push({ x, y: y - BH, w: x1 - x, h: BH * 2, line, dir: 'h', veg }); }
  for (let tx = x0 + 70; tx < x1 - 70 - TW; tx += 150) {
    if (gaps.some((gx) => tx + TW > gx - 36 && tx < gx + GAPW + 36)) continue;
    for (const side of [-1, 1]) {
      const ty = side < 0 ? y - BH - TH : y + BH;
      const s = { x: tx, y: ty, w: TW, h: TH, sx: tx + TW / 2, sy: side < 0 ? ty - 20 : ty + TH + 20, side, line, busy: null, veg, kind: kind || 'cut', vertical: false };
      L.add(tx, ty, TW, TH, 'table', { station: s });
      L.stations.push(s);
    }
  }
}
// 縦のベルト(上から下へ流れる)。作業台は左右に
function addVBelt(L, x, y0, y1, gaps, line, veg, kind) {
  const BW = 36; const TW = 30; const TH = 58; const GAPH = 124;
  let y = y0;
  for (const gy of gaps) {
    if (gy - y > 30) { L.add(x - BW, y, BW * 2, gy - y, 'belt'); L.belts.push({ x: x - BW, y, w: BW * 2, h: gy - y, line, dir: 'v', veg }); }
    y = gy + GAPH;
  }
  if (y1 - y > 30) { L.add(x - BW, y, BW * 2, y1 - y, 'belt'); L.belts.push({ x: x - BW, y, w: BW * 2, h: y1 - y, line, dir: 'v', veg }); }
  for (let ty = y0 + 60; ty < y1 - 60 - TH; ty += 140) {
    if (gaps.some((gy) => ty + TH > gy - 36 && ty < gy + GAPH + 36)) continue;
    for (const side of [-1, 1]) {
      const tx = side < 0 ? x - BW - TW : x + BW;
      const s = { x: tx, y: ty, w: TW, h: TH, sx: side < 0 ? tx - 22 : tx + TW + 22, sy: ty + TH / 2 + 8, side, line, busy: null, veg, kind: kind || 'cut', vertical: true };
      L.add(tx, ty, TW, TH, 'table', { station: s });
      L.stations.push(s);
    }
  }
}
function restCorner(L, x, y) {
  // 休憩コーナー: ロッカー・自販機・ベンチ
  L.add(x, y, 46, 150, 'locker');
  L.add(x + 70, y, 44, 70, 'vending');
  L.add(x + 130, y, 44, 70, 'vending');
  L.add(x + 200, y + 8, 90, 26, 'bench');
  L.spots.push({ x: x + 245, y: y + 56, kind: 'bench', dir: 1 });
  L.spots.push({ x: x + 92, y: y + 100, kind: 'lean', dir: 1 });
  L.spots.push({ x: x + 88, y: y + 190, kind: 'corner', dir: 1 });
}

// ---------- ステージ1: 横のライン ----------
function layoutRows(L, st) {
  const { W, rnd } = L;
  const LX0 = 330; const LX1 = W - 330;
  for (let i = 0; i < st.lines; i++) {
    const ly = 400 + i * 360;
    const nGap = 2 + (i % 2);
    const gaps = [];
    for (let g = 0; g < nGap; g++) {
      const segW = (LX1 - LX0) / nGap;
      gaps.push(clamp(LX0 + segW * g + segW * (0.25 + rnd() * 0.5) + (i % 2 ? 90 : -90), LX0 + 120, LX1 - 244));
    }
    gaps.sort((a, b) => a - b);
    addHBelt(L, LX0, LX1, ly, gaps, i, st.veg, 'cut');
    L.props.push({ type: 'lineSign', x: LX0 - 60, y: ly, text: '白菜 ' + (i + 1) });
  }
  restCorner(L, WALL, WALL);
  L.props.push({ type: 'sign', x: W / 2 - 300, y: WALL + 2, text: '衛生第一・手洗いうがい' });
  L.props.push({ type: 'sign', x: W / 2 + 160, y: WALL + 2, text: 'おしゃべり禁止' });
  L.add(W - WALL - 150, WALL, 150, 90, 'pallet');
  L.spots.push({ x: W - WALL - 75, y: WALL + 118, kind: 'lean', dir: -1 });
  L.spots.push({ x: WALL + 30, y: L.H / 2, kind: 'corner', dir: 1 });
  L.spots.push({ x: W - WALL - 30, y: L.H / 2 + 60, kind: 'corner', dir: -1 });
  L.gossipSpots.push({ x: W - WALL - 60, y: L.H - WALL - 70 }, { x: WALL + 70, y: L.H - WALL - 70 });
}

// ---------- ステージ2: 洗浄タンクから縦に流れるキャベツ ----------
function layoutColumns(L, st) {
  const { W, H, rnd } = L;
  const n = st.lines;
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(Math.round(430 + i * ((W - 860) / (n - 1))));
  const y0 = 330; const y1 = H - 430;
  xs.forEach((x, i) => {
    // 洗浄タンク(水にキャベツが浮かぶ)
    L.add(x - 70, 150, 140, 100, 'tank', { line: i });
    // すき間は列ごとにずらして、迷路のように
    const span = y1 - y0;
    const gaps = i % 2 ? [y0 + span * (0.22 + rnd() * 0.12), y0 + span * (0.66 + rnd() * 0.1)] : [y0 + span * (0.42 + rnd() * 0.12)];
    addVBelt(L, x, y0, y1, gaps, i, 'cabbage', 'cut');
    // 下で受けるコンテナ
    L.add(x - 46, y1 + 26, 92, 54, 'bins', { n: 2 });
    L.props.push({ type: 'lineSign', x, y: 300 - 40 - 10, text: 'キャベツ ' + (i + 1), small: true });
  });
  restCorner(L, WALL, H - WALL - 160);
  L.props.push({ type: 'sign', x: W * 0.25, y: WALL + 2, text: '洗浄 → カット → 計量' });
  L.props.push({ type: 'sign', x: W * 0.75, y: WALL + 2, text: '床がぬれています 注意' });
  // すみっこ・タンクの陰がサボり場所
  L.spots.push({ x: WALL + 40, y: 130, kind: 'corner', dir: 1 });
  L.spots.push({ x: W - WALL - 40, y: 130, kind: 'corner', dir: -1 });
  L.spots.push({ x: (xs[0] + xs[1]) / 2, y: 200, kind: 'lean', dir: 1 });
  L.spots.push({ x: (xs[n - 2] + xs[n - 1]) / 2, y: 200, kind: 'lean', dir: -1 });
  L.spots.push({ x: W - WALL - 40, y: H / 2, kind: 'corner', dir: -1 });
  L.spots.push({ x: WALL + 40, y: H / 2 - 100, kind: 'corner', dir: 1 });
  L.gossipSpots.push({ x: W - WALL - 70, y: H - WALL - 70 }, { x: (xs[2] + xs[3]) / 2, y: 200 }, { x: WALL + 360, y: H - WALL - 70 });
}

// ---------- ステージ3: 出荷フロア(コの字のコンベア・棚・シャッター) ----------
function layoutWarehouse(L, st) {
  const { W, H } = L;
  // 上の壁に出荷口のシャッターが3つ。まん中がボスの出入り口
  L.dock = { x: W / 2, y: WALL + 10, w: 220 };
  for (const [k, label] of [[0.2, '出荷口 1'], [0.5, '出荷口 2'], [0.8, '出荷口 3']]) L.props.push({ type: 'door', x: Math.round(W * k), y: WALL, w: 220, label, shutter: true });
  // シャッター前の出荷待ちパレット
  for (const k of [0.2, 0.8]) { L.add(Math.round(W * k) - 140, WALL + 60, 90, 80, 'wrap'); L.add(Math.round(W * k) + 50, WALL + 60, 90, 80, 'wrap'); }
  // コの字のコンベア: 上の横 → 右の縦 → 下の横(右から左へ)
  const yTop = 520; const yBot = 1440; const xR = W - 520; const xL0 = 380;
  addHBelt(L, xL0, xR - 60, yTop, [xL0 + 520, xL0 + 1300], 0, 'mix', 'pack');
  addVBelt(L, xR, yTop + 36, yBot - 36, [yTop + 380], 1, 'mix', 'pack');
  addHBelt(L, xL0 + 300, xR - 60, yBot, [xL0 + 760, xL0 + 1500], 2, 'mix', 'pack');
  L.add(xR - 60, yTop - 36, 96, 72, 'belt'); L.belts.push({ x: xR - 60, y: yTop - 36, w: 96, h: 72, line: 9, dir: 'corner', veg: 'mix' });
  L.add(xR - 60, yBot - 36, 96, 72, 'belt'); L.belts.push({ x: xR - 60, y: yBot - 36, w: 96, h: 72, line: 9, dir: 'corner', veg: 'mix' });
  L.props.push({ type: 'lineSign', x: xL0 - 60, y: yTop, text: '箱詰め A' });
  L.props.push({ type: 'lineSign', x: xL0 + 240, y: yBot, text: '箱詰め B' });
  // 左下と右に、背の高い棚(列のあいだは かくれ場所)
  for (const y of [1660, 1800, 1940]) { L.add(120, y, 360, 44, 'rack'); L.add(560, y, 360, 44, 'rack'); }
  for (const y of [700, 900, 1100]) L.add(W - WALL - 220, y, 200, 44, 'rack');
  // 中央の島: 手作業の箱詰め台
  for (let i = 0; i < 3; i++) {
    const cx = 760 + i * 340; const cy = 980;
    const s1 = { x: cx - 50, y: cy - 22, w: 100, h: 44, sx: cx, sy: cy - 50, side: -1, line: 5, busy: null, veg: i % 2 ? 'cabbage' : 'hakusai', kind: 'pack', vertical: false };
    const s2 = Object.assign({}, s1, { sy: cy + 50, side: 1 });
    L.add(cx - 50, cy - 22, 100, 44, 'packIsland', { station: s1 });
    L.stations.push(s1, s2);
  }
  restCorner(L, W - WALL - 300, H - WALL - 170);
  L.props.push({ type: 'sign', x: W * 0.35, y: WALL + 2, text: 'フォークリフト 注意' });
  L.props.push({ type: 'sign', x: W * 0.65, y: WALL + 2, text: '出荷時間を 守ろう' });
  L.spots.push({ x: 300, y: 1740, kind: 'lean', dir: 1 }, { x: 740, y: 1880, kind: 'lean', dir: -1 }, { x: 300, y: 2020, kind: 'corner', dir: 1 });
  L.spots.push({ x: W - WALL - 120, y: 800, kind: 'lean', dir: -1 }, { x: W - WALL - 120, y: 1000, kind: 'corner', dir: -1 });
  L.spots.push({ x: WALL + 40, y: 300, kind: 'corner', dir: 1 });
  L.gossipSpots.push({ x: 520, y: 1880 }, { x: W - WALL - 120, y: 1200 }, { x: WALL + 80, y: 1200 }, { x: W * 0.35, y: WALL + 130 });
}

// 段ボールなどを散らし、歩ける場所を求め、立ち位置を歩けるセルに寄せる
function finishWorld(L, st, stageNo) {
  const { W, H, rects, stations, spots, gossipSpots, rnd } = L;
  const T = CONFIG.tile;
  const keepClear = [];
  for (const s of stations) keepClear.push({ x: s.sx - 26, y: s.sy - 26, w: 52, h: 52 });
  for (const s of spots.concat(gossipSpots)) keepClear.push({ x: s.x - 40, y: s.y - 40, w: 80, h: 80 });
  keepClear.push({ x: L.start.x - 160, y: H - 220, w: 320, h: 200 });
  keepClear.push({ x: L.dock.x - L.dock.w / 2 - 40, y: 0, w: L.dock.w + 80, h: 220 });
  const boxType = st.layout === 'columns' ? 'bins' : st.layout === 'warehouse' ? 'wrap' : 'boxes';
  const boxes = [];
  let tries = 0;
  while (boxes.length < st.boxes && tries++ < 500) {
    const w = boxType === 'wrap' ? 90 : 50 + Math.floor(rnd() * 3) * 22; const h = boxType === 'wrap' ? 80 : 44 + Math.floor(rnd() * 2) * 22;
    const x = WALL + 60 + rnd() * (W - WALL * 2 - 120 - w);
    const y = WALL + 60 + rnd() * (H - WALL * 2 - 120 - h);
    const r = { x, y, w, h, type: boxType, n: 2 + Math.floor(rnd() * 3), veg: rnd() < 0.5 ? 'hakusai' : 'cabbage' };
    if (rects.some((o) => rectsOverlap(o, r, 56))) continue;
    if (keepClear.some((o) => rectsOverlap(o, r, 10))) continue;
    boxes.push(r); rects.push(r);
  }
  for (const b of boxes.slice(0, 5)) spots.push({ x: b.x + b.w / 2, y: b.y + b.h + 24, kind: 'lean', dir: 1, box: b });

  const gw = Math.ceil(W / T); const gh = Math.ceil(H / T);
  const blocked = new Uint8Array(gw * gh);
  const PAD = 15;
  const fillBlocked = () => {
    blocked.fill(0);
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
      const px = cx * T + T / 2; const py = cy * T + T / 2;
      for (const r of rects) { if (pointInRect(px, py, r, PAD)) { blocked[cy * gw + cx] = 1; break; } }
    }
  };
  fillBlocked();
  const cell = (x, y) => [clamp(Math.floor(x / T), 0, gw - 1), clamp(Math.floor(y / T), 0, gh - 1)];
  const sc = cell(L.start.x, L.start.y);
  let reach = floodFill(blocked, gw, gh, sc[0], sc[1]);
  const isReach = (x, y) => { const c = cell(x, y); return !!reach[c[1] * gw + c[0]]; };
  const targets = () => stations.map((s) => [s.sx, s.sy]).concat(spots.map((s) => [s.x, s.y]), gossipSpots.map((s) => [s.x, s.y]), [[L.dock.x, L.dock.y + 50]]);
  // 届かない場所を作ってしまった段ボールは取りのぞく
  for (let pass = 0; pass < 3 && !targets().every(([x, y]) => isReach(x, y)); pass++) {
    for (const b of boxes.slice()) {
      const near = targets().some(([x, y]) => !isReach(x, y) && Math.abs(x - (b.x + b.w / 2)) < 200 && Math.abs(y - (b.y + b.h / 2)) < 200);
      if (!near) continue;
      rects.splice(rects.indexOf(b), 1); boxes.splice(boxes.indexOf(b), 1);
      const sp = spots.findIndex((s) => s.box === b); if (sp >= 0) spots.splice(sp, 1);
    }
    fillBlocked();
    reach = floodFill(blocked, gw, gh, sc[0], sc[1]);
  }
  // 立つ場所が歩けないセルに乗っていたら、いちばん近い歩けるセルの中心へ寄せる
  const snap = (p) => {
    if (isReach(p.x, p.y)) return;
    let best = null; let bd = 1e18;
    for (let cy = 1; cy < gh - 1; cy++) for (let cx = 1; cx < gw - 1; cx++) {
      if (!reach[cy * gw + cx]) continue;
      const d = (cx * T + T / 2 - p.x) ** 2 + (cy * T + T / 2 - p.y) ** 2;
      if (d < bd) { bd = d; best = [cx * T + T / 2, cy * T + T / 2]; }
    }
    if (best) { p.x = best[0]; p.y = best[1]; }
  };
  for (const s of spots) snap(s);
  for (const s of gossipSpots) snap(s);
  for (const s of stations) { const q = { x: s.sx, y: s.sy }; snap(q); s.sx = q.x; s.sy = q.y; }
  const freeCells = [];
  for (let cy = 1; cy < gh - 1; cy++) for (let cx = 1; cx < gw - 1; cx++) if (reach[cy * gw + cx]) freeCells.push([cx * T + T / 2, cy * T + T / 2]);

  return { stage: stageNo, layout: st.layout || 'rows', W, H, T, rects, belts: L.belts, stations, spots, gossipSpots, props: L.props, boxes, dock: L.dock, start: L.start, blocked, reach, gw, gh, freeCells, veg: st.veg, rnd: mulberry32((CONFIG.tile + stageNo) * 31 + boxes.length) };
}

// セル座標 ⇔ ワールド座標
function toCell(w, x, y) { return [clamp(Math.floor(x / w.T), 0, w.gw - 1), clamp(Math.floor(y / w.T), 0, w.gh - 1)]; }
function cellCenter(w, cx, cy) { return [cx * w.T + w.T / 2, cy * w.T + w.T / 2]; }
// 2点のあいだに障害物がないか(半径 r の体が通れるか)
function lineClear(w, ax, ay, bx, by, r) {
  for (const rc of w.rects) if (segmentHitsRect(ax, ay, bx, by, rc, r)) return false;
  return true;
}
function nearestOpen(w, c) {
  if (!w.blocked[c[1] * w.gw + c[0]]) return c;
  let best = null; let bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const cx = c[0] + dx; const cy = c[1] + dy;
    if (cx < 0 || cy < 0 || cx >= w.gw || cy >= w.gh || w.blocked[cy * w.gw + cx]) continue;
    const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [cx, cy]; }
  }
  return best;
}
// 経路(ワールド座標の点列)。見つからないときは null
function findPath(w, ax, ay, bx, by) {
  const a = nearestOpen(w, toCell(w, ax, ay)); const b = nearestOpen(w, toCell(w, bx, by));
  if (!a || !b) return null;
  const cells = bfsPath(w.blocked, w.gw, w.gh, a[0], a[1], b[0], b[1]);
  if (!cells) return null;
  const pts = cells.map(([cx, cy]) => { const c = cellCenter(w, cx, cy); return { x: c[0], y: c[1] }; });
  pts.push({ x: bx, y: by });
  // 直線で行ける点は飛ばして、カクカクしない経路にする
  const out = [];
  let from = { x: ax, y: ay };
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(w, from.x, from.y, pts[j].x, pts[j].y, 16)) j--;
    out.push(pts[j]); from = pts[j]; i = j + 1;
  }
  return out;
}
