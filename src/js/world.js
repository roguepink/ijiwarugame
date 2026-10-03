'use strict';
/* 工場のマップを作る。ベルトコンベア(ライン)が横に何本も走り、通路でぐるぐる回れる。
   すべて矩形の障害物(rects)で表し、歩ける場所は起動時に塗りつぶしで求める */

function buildWorld(stageNo, seed) {
  const st = CONFIG.stages[stageNo];
  const rnd = mulberry32((seed || 1) + stageNo * 977);
  const T = CONFIG.tile;
  const W = st.W;
  const H = st.lines * 360 + 420;
  const rects = [];        // 障害物 {x,y,w,h,type}
  const belts = [];        // ベルトの描画用 {x,y,w,h,line}
  const stations = [];     // 作業台 {x,y,w,h, sx,sy(立つ位置), side, line}
  const spots = [];        // サボり場所 {x,y,kind:'lean'|'bench'|'corner', dir}
  const gossipSpots = [];  // 悪口コンビの場所 {x,y}
  const props = [];        // 飾り(当たりなし) {type,x,y,...}
  const add = (x, y, w, h, type) => { const r = { x, y, w, h, type }; rects.push(r); return r; };

  // 壁
  const WALL = 40;
  add(0, 0, W, WALL, 'wall'); add(0, H - WALL, W, WALL, 'wall'); add(0, 0, WALL, H, 'wall'); add(W - WALL, 0, WALL, H, 'wall');
  const dock = { x: W / 2, y: WALL + 10, w: 220 }; // 搬入口(ボスが入ってくる)
  props.push({ type: 'door', x: dock.x, y: WALL, w: dock.w });

  // ライン
  const LX0 = 330; const LX1 = W - 330;
  const BH = 36; const TH = 30; const TW = 58; const GAPW = 124;
  for (let i = 0; i < st.lines; i++) {
    const ly = 400 + i * 360;
    // 通れるすき間を 2〜3 か所、前のラインとずらして置く
    const nGap = 2 + (i % 2);
    const gaps = [];
    for (let g = 0; g < nGap; g++) {
      const segW = (LX1 - LX0) / nGap;
      const gx = LX0 + segW * g + segW * (0.25 + rnd() * 0.5) + (i % 2 ? 90 : -90);
      gaps.push(clamp(gx, LX0 + 120, LX1 - 120 - GAPW));
    }
    gaps.sort((a, b) => a - b);
    let x = LX0;
    for (const gx of gaps) {
      if (gx - x > 30) { add(x, ly - BH, gx - x, BH * 2, 'belt'); belts.push({ x, y: ly - BH, w: gx - x, h: BH * 2, line: i }); }
      x = gx + GAPW;
    }
    add(x, ly - BH, LX1 - x, BH * 2, 'belt'); belts.push({ x, y: ly - BH, w: LX1 - x, h: BH * 2, line: i });
    // 作業台(ベルトの両側)。すき間の前後には置かない
    for (let tx = LX0 + 70; tx < LX1 - 70 - TW; tx += 150) {
      const inGap = gaps.some((gx) => tx + TW > gx - 36 && tx < gx + GAPW + 36);
      if (inGap) continue;
      for (const side of [-1, 1]) {
        const ty = side < 0 ? ly - BH - TH : ly + BH;
        const r = add(tx, ty, TW, TH, 'table');
        r.side = side; r.line = i;
        stations.push({ x: tx, y: ty, w: TW, h: TH, sx: tx + TW / 2, sy: side < 0 ? ty - 20 : ty + TH + 20, side, line: i, busy: null, veg: st.veg === 'mix' ? (i % 2 ? 'cabbage' : 'hakusai') : st.veg });
      }
    }
    props.push({ type: 'lineSign', x: LX0 - 60, y: ly, line: i, text: (st.veg === 'mix' ? (i % 2 ? 'キャベツ' : '白菜') : st.veg === 'cabbage' ? 'キャベツ' : '白菜') + ' ' + (i + 1) });
  }

  // 休憩コーナー(左上): 自販機・ベンチ・ロッカー
  add(WALL, WALL, 46, 150, 'locker');
  add(WALL + 70, WALL, 44, 70, 'vending');
  add(WALL + 130, WALL, 44, 70, 'vending');
  add(WALL + 200, WALL + 8, 90, 26, 'bench');
  spots.push({ x: WALL + 245, y: WALL + 56, kind: 'bench', dir: 1 });
  spots.push({ x: WALL + 92, y: WALL + 100, kind: 'lean', dir: 1 });
  spots.push({ x: WALL + 24 + 46 + 18, y: WALL + 190, kind: 'corner', dir: 1 });
  props.push({ type: 'sign', x: W / 2 - 300, y: WALL + 2, text: '衛生第一・手洗いうがい' });
  props.push({ type: 'sign', x: W / 2 + 160, y: WALL + 2, text: 'おしゃべり禁止' });
  props.push({ type: 'floorMark', x: W / 2, y: H - 110, text: '入口' });
  // 右上: パレット置き場 (段ボールのかたまり)
  add(W - WALL - 150, WALL, 150, 90, 'pallet');
  spots.push({ x: W - WALL - 75, y: WALL + 118, kind: 'lean', dir: -1 });
  gossipSpots.push({ x: W - WALL - 60, y: H - WALL - 70 });
  gossipSpots.push({ x: WALL + 70, y: H - WALL - 70 });
  spots.push({ x: WALL + 30, y: H / 2, kind: 'corner', dir: 1 });
  spots.push({ x: W - WALL - 30, y: H / 2 + 60, kind: 'corner', dir: -1 });

  // 段ボールの山(通路にランダム)。立つ場所やすき間をふさがないように置く
  const keepClear = [];
  for (const s of stations) keepClear.push({ x: s.sx - 26, y: s.sy - 26, w: 52, h: 52 });
  for (const s of spots.concat(gossipSpots)) keepClear.push({ x: s.x - 40, y: s.y - 40, w: 80, h: 80 });
  keepClear.push({ x: W / 2 - 160, y: H - 220, w: 320, h: 200 }); // スタート地点
  keepClear.push({ x: dock.x - dock.w / 2 - 40, y: 0, w: dock.w + 80, h: 220 }); // 搬入口
  const boxes = [];
  let tries = 0;
  while (boxes.length < st.boxes && tries++ < 400) {
    const w = 50 + Math.floor(rnd() * 3) * 22; const h = 44 + Math.floor(rnd() * 2) * 22;
    const x = WALL + 60 + rnd() * (W - WALL * 2 - 120 - w);
    const y = WALL + 60 + rnd() * (H - WALL * 2 - 120 - h);
    const r = { x, y, w, h, type: 'boxes', n: 2 + Math.floor(rnd() * 3), veg: rnd() < 0.5 ? 'hakusai' : 'cabbage' };
    if (rects.some((o) => rectsOverlap(o, r, 56))) continue;
    if (keepClear.some((o) => rectsOverlap(o, r, 10))) continue;
    boxes.push(r);
    rects.push(r);
  }
  // 段ボールの陰もサボり場所になる
  for (const b of boxes.slice(0, 5)) spots.push({ x: b.x + b.w / 2, y: b.y + b.h + 24, kind: 'lean', dir: 1, box: b });

  // 歩けるセル(中心が障害物に近いセルはふさがる)
  const gw = Math.ceil(W / T); const gh = Math.ceil(H / T);
  const blocked = new Uint8Array(gw * gh);
  const PAD = 15;
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      const px = cx * T + T / 2; const py = cy * T + T / 2;
      for (const r of rects) { if (pointInRect(px, py, r, PAD)) { blocked[cy * gw + cx] = 1; break; } }
    }
  }
  const start = { x: W / 2, y: H - 130 };
  const cell = (x, y) => [clamp(Math.floor(x / T), 0, gw - 1), clamp(Math.floor(y / T), 0, gh - 1)];
  const sc = cell(start.x, start.y);
  let reach = floodFill(blocked, gw, gh, sc[0], sc[1]);
  // 届かない場所を作ってしまった段ボールは取りのぞく
  const isReach = (x, y) => { const c = cell(x, y); return !!reach[c[1] * gw + c[0]]; };
  const targets = stations.map((s) => [s.sx, s.sy]).concat(spots.map((s) => [s.x, s.y]), gossipSpots.map((s) => [s.x, s.y]), [[dock.x, dock.y + 50]]);
  for (let pass = 0; pass < 3 && !targets.every(([x, y]) => isReach(x, y)); pass++) {
    for (const b of boxes.slice()) {
      const near = targets.some(([x, y]) => !isReach(x, y) && Math.abs(x - (b.x + b.w / 2)) < 200 && Math.abs(y - (b.y + b.h / 2)) < 200);
      if (!near) continue;
      rects.splice(rects.indexOf(b), 1); boxes.splice(boxes.indexOf(b), 1);
      const sp = spots.findIndex((s) => s.box === b); if (sp >= 0) spots.splice(sp, 1);
    }
    blocked.fill(0);
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
      const px = cx * T + T / 2; const py = cy * T + T / 2;
      for (const r of rects) { if (pointInRect(px, py, r, PAD)) { blocked[cy * gw + cx] = 1; break; } }
    }
    reach = floodFill(blocked, gw, gh, sc[0], sc[1]);
  }
  // 立つ場所が障害物に近すぎて歩けないセルに乗っていたら、いちばん近い歩けるセルの中心へ寄せる
  const snap = (p) => {
    if (isReach(p.x, p.y)) return;
    let best = null; let bd = 1e9;
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
  // 歩ける空きセルのリスト(ハリセンを落とす場所などに使う)
  const freeCells = [];
  for (let cy = 1; cy < gh - 1; cy++) for (let cx = 1; cx < gw - 1; cx++) if (reach[cy * gw + cx]) freeCells.push([cx * T + T / 2, cy * T + T / 2]);

  return { stage: stageNo, W, H, T, rects, belts, stations, spots, gossipSpots, props, boxes, dock, start, blocked, reach, gw, gh, freeCells, veg: st.veg, rnd: mulberry32((seed || 1) * 31 + stageNo) };
}

// セル座標 ⇔ ワールド座標
function toCell(w, x, y) { return [clamp(Math.floor(x / w.T), 0, w.gw - 1), clamp(Math.floor(y / w.T), 0, w.gh - 1)]; }
function cellCenter(w, cx, cy) { return [cx * w.T + w.T / 2, cy * w.T + w.T / 2]; }
// 2点のあいだに障害物がないか(半径 r の体が通れるか)
function lineClear(w, ax, ay, bx, by, r) {
  for (const rc of w.rects) if (segmentHitsRect(ax, ay, bx, by, rc, r)) return false;
  return true;
}
// 経路(ワールド座標の点列)。見つからないときは null
function findPath(w, ax, ay, bx, by) {
  const a = toCell(w, ax, ay); const b = toCell(w, bx, by);
  // 目的地のセルがふさがっていたら、近くの歩けるセルに寄せる
  if (w.blocked[b[1] * w.gw + b[0]]) {
    let best = null; let bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = b[0] + dx; const cy = b[1] + dy;
      if (cx < 0 || cy < 0 || cx >= w.gw || cy >= w.gh || w.blocked[cy * w.gw + cx]) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [cx, cy]; }
    }
    if (!best) return null;
    b[0] = best[0]; b[1] = best[1];
  }
  if (w.blocked[a[1] * w.gw + a[0]]) {
    let best = null; let bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = a[0] + dx; const cy = a[1] + dy;
      if (cx < 0 || cy < 0 || cx >= w.gw || cy >= w.gh || w.blocked[cy * w.gw + cx]) continue;
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [cx, cy]; }
    }
    if (!best) return null;
    a[0] = best[0]; a[1] = best[1];
  }
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
