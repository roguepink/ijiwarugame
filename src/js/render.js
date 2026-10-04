'use strict';
/* 描画パイプライン: 床 → ベルトコンベア(流れる野菜) → 奥から手前へ並べた物体(作業台・段ボール・人) → 効果 → ふきだし */

const Render = (() => {
  const FONT = '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP","Noto Sans CJK JP","WenQuanYi Zen Hei",sans-serif';
  const OUT = Art.OUT;
  let spriteScale = 0;
  let floorPattern = null;
  let patternTried = false;
  let fxRed = null; let fxBlue = null;
  let fxLast = { r: -1, b: -1 };
  let miniBase = null;
  const drawList = [];

  // ---------- 初期化・リサイズ ----------
  function resize() {
    const canvas = G.canvas;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxDpr) * (G.rs || 1);
    while (W * H * dpr * dpr > CONFIG.view.maxPixels && dpr > 0.5) dpr *= 0.9;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const V = CONFIG.view;
    let zoom = Math.sqrt((W * H) / V.targetArea);
    zoom = Math.min(zoom, W / V.minW, H / V.minH);
    const v = G.view;
    v.W = W; v.H = H; v.dpr = dpr; v.zoom = zoom; v.vw = W / zoom; v.vh = H / zoom;
    const need = clamp(Math.ceil(zoom * dpr), 1, 4);
    if (need !== spriteScale) { spriteScale = need; Art.init(need); floorPattern = null; patternTried = false; }
    const mm = G.mini;
    if (mm) { const size = Math.round(parseFloat(getComputedStyle(mm).width) || 140); mm.width = Math.round(size * dpr); mm.height = Math.round(size * 0.66 * dpr); }
  }
  // 重い端末用: 描画の細かさを一段さげる
  function lowerQuality() {
    const cur = G.rs || 1;
    if (cur <= 0.6) return false;
    G.rs = Math.max(0.6, cur - 0.15);
    resize();
    return true;
  }

  const TH = () => CONFIG.stages[G.stage].theme;
  let floorStage = -1;

  // 床: ステージ1は白いタイル、2はミントのタイル、3はコンクリートの大きな床
  function makeFloorPattern(ctx) {
    patternTried = true;
    floorStage = G.stage;
    const th = TH();
    const tile = th.tile;
    const TILE_U = tile ? tile * 2 : 240;
    let ps = Math.max(1, spriteScale);
    const test = ctx.createPattern(document.createElement('canvas'), 'repeat');
    const canScale = !!(test && typeof test.setTransform === 'function' && typeof DOMMatrix !== 'undefined');
    if (!canScale) ps = 1;
    const c = document.createElement('canvas');
    c.width = TILE_U * ps; c.height = TILE_U * ps;
    const g = c.getContext('2d');
    g.scale(ps, ps);
    g.fillStyle = th.floorA; g.fillRect(0, 0, TILE_U, TILE_U);
    const rnd = mulberry32(3 + G.stage);
    if (tile) {
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
        const k = rnd();
        g.fillStyle = k < 0.5 ? th.floorA : th.floorB;
        g.fillRect(tx * tile + 1.5, ty * tile + 1.5, tile - 3, tile - 3);
        const gr = g.createLinearGradient(tx * tile, ty * tile, tx * tile + tile, ty * tile + tile);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,90,80,0.07)');
        g.fillStyle = gr; g.fillRect(tx * tile + 1.5, ty * tile + 1.5, tile - 3, tile - 3);
      }
      g.strokeStyle = th.grout; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tile, 0); g.lineTo(tile, TILE_U); g.moveTo(0, tile); g.lineTo(TILE_U, tile); g.moveTo(0, 0.5); g.lineTo(TILE_U, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, TILE_U); g.stroke();
    } else {
      // コンクリート: まだら・小さな粒・ひび・目地
      for (let i = 0; i < 26; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(rnd() * TILE_U, rnd() * TILE_U, 14 + rnd() * 40, 8 + rnd() * 24, rnd() * 3, 0, TAU); g.fill(); }
      for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(90,75,55,0.18)' : 'rgba(255,255,255,0.35)'; g.fillRect(rnd() * TILE_U, rnd() * TILE_U, 1.6, 1.6); }
      g.strokeStyle = 'rgba(100,85,60,0.18)'; g.lineWidth = 1.2; g.beginPath(); let x = rnd() * TILE_U; let y = rnd() * TILE_U; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (rnd() - 0.5) * 40; y += rnd() * 20; g.lineTo(x, y); } g.stroke();
      g.strokeStyle = th.grout; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 1.5); g.lineTo(TILE_U, 1.5); g.moveTo(1.5, 0); g.lineTo(1.5, TILE_U); g.stroke();
    }
    floorPattern = ctx.createPattern(c, 'repeat');
    if (canScale && floorPattern) { try { floorPattern.setTransform(new DOMMatrix().scale(1 / ps)); } catch (e) { floorPattern = null; } }
  }

  // ---------- 床・壁・ライン ----------
  function drawFloor(ctx, t, left, top, right, bottom) {
    if (floorStage !== G.stage) { floorPattern = null; patternTried = false; }
    if (!floorPattern && !patternTried) makeFloorPattern(ctx);
    const th = TH();
    ctx.fillStyle = floorPattern || th.floorA;
    ctx.fillRect(left, top, right - left, bottom - top);
    const W = G.world;
    // ぬれた床(キャベツライン): 水たまりが きらきら
    if (W.layout === 'columns') {
      if (!W.puddles) { const r = mulberry32(77); W.puddles = []; for (let i = 0; i < 26; i++) { const c = W.freeCells[Math.floor(r() * W.freeCells.length)]; W.puddles.push([c[0] + (r() - 0.5) * 30, c[1] + (r() - 0.5) * 30, 26 + r() * 40, r() * 6]); } }
      for (const [x, y, rr, ph] of W.puddles) {
        if (x < left - rr || x > right + rr || y < top - rr || y > bottom + rr) continue;
        ctx.fillStyle = 'rgba(110,190,230,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(t * 2 + ph) * 0.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x - rr * 0.2, y - rr * 0.1, rr * 0.4, rr * 0.12, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
      }
    }
    // 出荷フロア: シャッター前の しまもようの荷さばき場と、フォークリフトの通路の矢印
    if (W.layout === 'warehouse') {
      for (const p of W.props) {
        if (p.type !== 'door') continue;
        const x0 = p.x - p.w / 2 - 30; const y0 = 50; const w = p.w + 60; const h = 120;
        if (x0 > right || x0 + w < left || y0 > bottom) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
        ctx.fillStyle = 'rgba(255,200,40,0.18)'; ctx.fillRect(x0, y0, w, h);
        ctx.strokeStyle = 'rgba(60,45,30,0.16)'; ctx.lineWidth = 12;
        for (let x = x0 - h; x < x0 + w; x += 34) { ctx.beginPath(); ctx.moveTo(x, y0 + h); ctx.lineTo(x + h, y0); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = th.lane; ctx.lineWidth = 5; ctx.strokeRect(x0, y0, w, h);
      }
      ctx.fillStyle = 'rgba(255,190,20,0.35)';
      for (let x = 200; x < W.W - 200; x += 260) { const y = W.H - 260; if (x < left - 40 || x > right + 40 || y < top - 40 || y > bottom + 40) continue; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x + 40, y); ctx.lineTo(x, y + 16); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = th.lane; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(120, W.H - 300); ctx.lineTo(W.W - 120, W.H - 300); ctx.moveTo(120, W.H - 220); ctx.lineTo(W.W - 120, W.H - 220); ctx.stroke();
    }
    // 安全ライン(ベルトの両わき)
    ctx.strokeStyle = th.lane; ctx.lineWidth = 6; ctx.setLineDash([30, 18]);
    for (const b of W.belts) {
      if (b.dir === 'corner') continue;
      if (b.x - 120 > right || b.x + b.w + 120 < left || b.y - 120 > bottom || b.y + b.h + 120 < top) continue;
      ctx.beginPath();
      if (b.dir === 'v') { ctx.moveTo(b.x - 96, b.y - 20); ctx.lineTo(b.x - 96, b.y + b.h + 20); ctx.moveTo(b.x + b.w + 96, b.y - 20); ctx.lineTo(b.x + b.w + 96, b.y + b.h + 20); }
      else { ctx.moveTo(b.x - 20, b.y - 92); ctx.lineTo(b.x + b.w + 20, b.y - 92); ctx.moveTo(b.x - 20, b.y + b.h + 92); ctx.lineTo(b.x + b.w + 20, b.y + b.h + 92); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const p of W.props) {
      if (p.type === 'floorMark') {
        ctx.fillStyle = 'rgba(80,160,230,0.18)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x - 90, p.y - 40, 180, 80, 14) : ctx.rect(p.x - 90, p.y - 40, 180, 80); ctx.fill();
        ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(60,120,200,0.45)'; ctx.fillText(p.text, p.x, p.y);
      }
    }
  }
  function drawWalls(ctx, left, top, right, bottom) {
    const W = G.world;
    const th = TH();
    for (const r of W.rects) {
      if (r.type !== 'wall') continue;
      if (r.x > right || r.x + r.w < left || r.y > bottom || r.y + r.h < top) continue;
      ctx.fillStyle = th.wall; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = th.wallLight; if (r.h > r.w) ctx.fillRect(r.x + 6, r.y, r.w - 12, r.h); else ctx.fillRect(r.x, r.y + 6, r.w, r.h - 12);
      ctx.strokeStyle = 'rgba(60,60,60,0.25)'; ctx.lineWidth = 2; ctx.beginPath();
      const step = W.layout === 'warehouse' ? 60 : 120;
      if (r.h > r.w) for (let y = r.y; y < r.y + r.h; y += step) { ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); } else for (let x = r.x; x < r.x + r.w; x += step) { ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); }
      ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const p of W.props) {
      if (p.type === 'door') {
        const isDock = Math.abs(p.x - W.dock.x) < 2;
        const open = isDock && (G.boss && G.boss.state === 'enter' ? 1 : (G.bossIntro > 0 ? 0.6 : 0));
        const x0 = p.x - p.w / 2;
        ctx.fillStyle = '#5a6678'; ctx.fillRect(x0, 0, p.w, 44);
        if (p.shutter && !open) {
          // 出荷口のシャッター(銀色の波板)
          const gr = ctx.createLinearGradient(0, 4, 0, 44); gr.addColorStop(0, '#d9dde3'); gr.addColorStop(1, '#a9b0ba');
          ctx.fillStyle = gr; ctx.fillRect(x0 + 6, 4, p.w - 12, 40);
          ctx.strokeStyle = 'rgba(60,70,85,0.45)'; ctx.lineWidth = 2; for (let y = 8; y < 44; y += 5) { ctx.beginPath(); ctx.moveTo(x0 + 6, y); ctx.lineTo(x0 + p.w - 6, y); ctx.stroke(); }
        } else {
          ctx.fillStyle = open ? '#2a2f3a' : '#8a97aa'; ctx.fillRect(x0 + 8, 4, p.w - 16, 40);
          if (!open) { ctx.strokeStyle = 'rgba(40,50,70,0.5)'; ctx.lineWidth = 2; for (let y = 10; y < 44; y += 8) { ctx.beginPath(); ctx.moveTo(x0 + 8, y); ctx.lineTo(x0 + p.w - 8, y); ctx.stroke(); } }
        }
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(x0, 0, p.w, 44);
        for (let x = x0; x < x0 + p.w; x += 24) { ctx.fillStyle = (Math.floor(x / 24) % 2) ? '#ffcf3a' : '#2f2a3a'; ctx.fillRect(x, 44, Math.min(24, x0 + p.w - x), 8); }
        ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText(p.label || '搬入口', p.x, 23); ctx.fillStyle = '#fff'; ctx.fillText(p.label || '搬入口', p.x, 23);
      } else if (p.type === 'sign') {
        ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(p.text).width + 24;
        Art.rrect(ctx, p.x - w / 2, p.y + 6, w, 28, 4, '#fff', 2.4, th.sign);
        ctx.fillStyle = th.sign; ctx.fillText(p.text, p.x, p.y + 20);
      } else if (p.type === 'lineSign') {
        ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = Math.max(88, ctx.measureText(p.text).width + 20);
        Art.rrect(ctx, p.x - w / 2, p.y - 16, w, 32, 6, th.lineSign, 2.4);
        ctx.fillStyle = '#fff'; ctx.fillText(p.text, p.x, p.y);
      }
    }
  }
  // ベルトコンベア: 横は右へ、縦は下へ、角は回る台
  function drawBelts(ctx, t, left, top, right, bottom) {
    const W = G.world;
    const S = Art.S;
    const th = TH();
    const speed = 70;
    for (const b of W.belts) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      Art.rrect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, b.dir === 'corner' ? 30 : 8, th.frame, 3);
      ctx.fillStyle = '#3a3f4c';
      if (b.dir === 'corner') {
        ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 2 - 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const a = t * 1.4 + (i * TAU) / 6; ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2 + Math.cos(a) * 30, b.y + b.h / 2 + Math.sin(a) * 30); ctx.stroke(); }
        continue;
      }
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const off = (t * speed) % 40;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath();
      if (b.dir === 'v') { for (let y = b.y + off; y < b.y + b.h; y += 40) { ctx.moveTo(b.x + 4, y); ctx.lineTo(b.x + b.w - 4, y - 6); } }
      else { for (let x = b.x + off; x < b.x + b.w; x += 40) { ctx.moveTo(x, b.y + 4); ctx.lineTo(x - 6, b.y + b.h - 4); } }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; if (b.dir === 'v') ctx.fillRect(b.x, b.y, 6, b.h); else ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = '#6a7486'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      if (b.dir === 'v') { for (const y of [b.y, b.y + b.h]) { ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, y, b.w / 2 + 2, 7, 0, 0, TAU); ctx.fill(); ctx.stroke(); } }
      else { for (const x of [b.x, b.x + b.w]) { ctx.beginPath(); ctx.ellipse(x, b.y + b.h / 2, 7, b.h / 2 + 2, 0, 0, TAU); ctx.fill(); ctx.stroke(); } }
      // 流れてくるもの: 白菜・キャベツ。出荷フロアは 段ボール箱も
      const period = 68;
      const shift = (t * speed) % period;
      const len = b.dir === 'v' ? b.h : b.w;
      for (let d = 20 + shift; d < len - 14; d += period) {
        const k = Math.floor((d - shift) / period + b.line * 7);
        if ((k * 7919) % 5 === 0) continue; // ときどき空く
        const wob = Math.sin(k * 1.7) * 6;
        const x = b.dir === 'v' ? b.x + b.w / 2 + wob : b.x + d;
        const y = b.dir === 'v' ? b.y + d : b.y + b.h / 2 + wob;
        if (x < left - 30 || x > right + 30 || y < top - 30 || y > bottom + 30) continue;
        let kind = b.veg === 'mix' ? (k % 3 === 0 ? 'box' : k % 2 ? 'cabbage' : 'hakusai') : b.veg;
        if (kind === 'box') Art.blit(ctx, S.boxSmall, x, y + 8, 1);
        else Art.blit(ctx, kind === 'cabbage' ? S.cabbageSmall : S.hakusaiSmall, x, y, 1);
      }
    }
  }

  // ---------- 奥から手前へ描く物 ----------
  function pushDraw(y, fn) { drawList.push({ y, fn }); }
  function drawProps(ctx, t, left, top, right, bottom) {
    const W = G.world; const S = Art.S;
    for (const r of W.rects) {
      if (r.type === 'wall' || r.type === 'belt') continue;
      if (r.x > right + 60 || r.x + r.w < left - 60 || r.y > bottom + 140 || r.y + r.h < top - 60) continue;
      const cx = r.x + r.w / 2; const by = r.y + r.h;
      switch (r.type) {
        case 'table': {
          const st = r.station || {};
          const veg = st.veg === 'mix' || !st.veg ? 'cabbage' : st.veg;
          if (st.vertical) pushDraw(by - 1, () => Art.blit(ctx, st.kind === 'pack' ? S.packV : S.tableV[veg], cx, by + 2, 1));
          else pushDraw(by - 1, () => Art.blit(ctx, st.kind === 'pack' ? S.pack : S.table[veg], cx, by + 2, 1));
          break;
        }
        case 'packIsland': pushDraw(by, () => Art.blit(ctx, S.packIsland, cx, by + 4, 1)); break;
        case 'boxes': pushDraw(by, () => { const n = r.n || 2; for (let i = 0; i < Math.round(r.w / 30); i++) for (let j = 0; j < n; j++) { Art.blit(ctx, S.box, r.x + 24 + i * 30 + (j % 2) * 4, by - j * 22 + (i % 2) * 2, 1); } if (r.veg) { ctx.save(); ctx.translate(r.x + 30, by - n * 22 - 10); ctx.scale(0.55, 0.55); Art.drawVeg(ctx, r.veg, 16); ctx.restore(); } }); break;
        case 'bins': pushDraw(by, () => Art.drawBins(ctx, r)); break;
        case 'wrap': pushDraw(by, () => Art.blit(ctx, S.wrap, cx, by + 4, 1)); break;
        case 'rack': pushDraw(by, () => Art.drawRack(ctx, r)); break;
        case 'tank': pushDraw(by, () => Art.drawTank(ctx, r, t)); break;
        case 'vending': pushDraw(by, () => Art.blit(ctx, S.vending, cx, by, 1)); break;
        case 'locker': pushDraw(by, () => Art.blit(ctx, S.locker, cx, by, 1)); break;
        case 'bench': pushDraw(by, () => Art.blit(ctx, S.bench, cx, by + 6, 1)); break;
        case 'pallet': pushDraw(by, () => Art.blit(ctx, S.pallet, cx, by + 8, 1)); break;
        default: break;
      }
    }
    for (const p of G.pickups) {
      if (p.x < left - 60 || p.x > right + 60 || p.y < top - 60 || p.y > bottom + 60) continue;
      pushDraw(p.y, () => {
        const bob = Math.sin(p.t * 3) * 3;
        const H = CONFIG.harisen[p.type];
        ctx.save(); ctx.translate(p.x, p.y);
        const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 36); gr.addColorStop(0, hexA(H.color, 0.5)); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.fill();
        ctx.translate(0, bob);
        Art.blit(ctx, S.pick[p.type], 0, 0, 1);
        for (let i = 0; i < 3; i++) { const a = p.t * 2 + (i * TAU) / 3; Art.star(ctx, Math.cos(a) * 30, -20 + Math.sin(a) * 10, 4, a, '#fff', 1.2); }
        ctx.restore();
        if (p.life < 6 && Math.floor(p.life * 6) % 2 === 0) { /* 点滅 */ } else {
          ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(H.short, p.x, p.y - 48 + bob); ctx.fillStyle = H.color; ctx.fillText(H.short, p.x, p.y - 48 + bob);
        }
      });
    }
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  function drawWorkers(ctx, t, left, top, right, bottom) {
    const cue = G.diff.cue;
    for (const w of G.workers) {
      if (w.x < left - 80 || w.x > right + 80 || w.y < top - 100 || w.y > bottom + 60) continue;
      pushDraw(w.y, () => {
        ctx.save(); ctx.translate(w.x, w.y);
        // やさしい難易度: 悪い人のまわりに うすい紫のトーン
        if (cue === 0 && w.kind !== 'good' && w.state !== 'bow') Art.drawTone(ctx, 34, 0.22 + Math.sin(t * 3 + w.seed) * 0.05, t);
        if (w.hitT > 0.35) { ctx.filter = 'brightness(1.8)'; }
        const eyes = workerEyes(w);
        const pose = workerPose(w);
        Art.drawWorker(ctx, { face: w.face, walkT: w.walkT, moving: w.moving, pose, t: t + w.seed, eyes, veg: w.veg, workKind: w.workKind, blush: w.kind === 'good' && !w.reformed, badge: w.badge, dizzy: w.state === 'dizzy' });
        ctx.filter = 'none';
        // 改心したての人は頭の上にキラキラ(叩かないで!)
        if (w.reformed && w.kind === 'good') {
          const k = clamp(w.relapseT / 6, 0, 1);
          Art.star(ctx, 0, -82 + Math.sin(t * 4) * 2, 8, t * 2, k < 1 ? (Math.floor(t * 6) % 2 ? '#ffd24d' : '#ff9a5c') : '#ffd24d', 1.4);
          if (k < 1) { ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText('…ムズムズ', 0, -96); ctx.fillStyle = '#ff9a5c'; ctx.fillText('…ムズムズ', 0, -96); }
        }
        // サボりの Zzz / 泣いている人の涙 / 困っている人の「!」
        if (w.state === 'slack' && w.pose !== 'phone') { ctx.font = `800 ${18 + Math.sin(t * 2 + w.seed) * 2}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; const zy = -76 - ((t * 10 + w.seed * 7) % 18); ctx.strokeText('z', 18, zy); ctx.fillStyle = '#9ac4ff'; ctx.fillText('z', 18, zy); }
        if (w.state === 'upset' || w.state === 'cry') { ctx.font = `800 28px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(w.state === 'cry' ? '…' : '!', 20, -74); ctx.fillStyle = w.state === 'cry' ? '#9ac4ff' : '#ff7a3d'; ctx.fillText(w.state === 'cry' ? '…' : '!', 20, -74); }
        ctx.restore();
      });
    }
  }
  function drawBossEntity(ctx, t) {
    const B = G.boss; if (!B) return;
    pushDraw(B.y, () => {
      ctx.save(); ctx.translate(B.x, B.y);
      if (B.hitFlash > 0.15) ctx.filter = 'brightness(1.7)';
      Art.drawBoss(ctx, B, t);
      ctx.filter = 'none';
      ctx.restore();
      // 名前
      ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(B.name, B.x, B.y - 150); ctx.fillStyle = B.state === 'defeated' ? '#9ac4ff' : '#ff8ad0'; ctx.fillText(B.name, B.x, B.y - 150);
    });
  }
  function drawPlayerEntity(ctx, t) {
    const P = G.player;
    pushDraw(P.y, () => {
      ctx.save(); ctx.translate(P.x, P.y);
      if (P.invT > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.55;
      Art.drawPlayer(ctx, P, t);
      ctx.restore();
    });
  }

  // ---------- 効果 ----------
  function drawSwings(ctx) {
    for (const s of G.swings) {
      const k = s.t / s.dur;
      const H = CONFIG.harisen[s.type];
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.globalAlpha = (1 - k) * 0.8;
      const a0 = s.aim - s.dir * s.arc / 2; const a1 = s.aim + s.dir * s.arc / 2;
      const sweep = s.dir > 0 ? [a0, a0 + s.arc * Math.min(1, k * 1.8)] : [a0 - s.arc * Math.min(1, k * 1.8), a0];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s.range, sweep[0], sweep[1], false); ctx.closePath();
      const gr = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, hexA(H.color, 0.35)); gr.addColorStop(1, 'rgba(255,255,255,0.8)');
      ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, s.range - 2, sweep[0], sweep[1], false); ctx.stroke();
      ctx.restore();
      void a1;
    }
    for (const im of G.impacts) {
      const k = im.t / 0.22;
      ctx.save(); ctx.translate(im.x, im.y); ctx.globalAlpha = 1 - k;
      const r = (im.big ? 36 : 26) * (0.6 + k * 0.8);
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const rr = i % 2 ? r * 0.55 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.restore();
    }
    for (const z of G.zaps) {
      const k = z.t / 0.22;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; ctx.strokeStyle = '#fff6a8'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(z.x0, z.y0);
      const n = 6; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(lerp(z.x0, z.x1, t) + (Math.sin(i * 7.3 + z.t * 90) * 12), lerp(z.y0, z.y1, t) + Math.cos(i * 5.1 + z.t * 70) * 12); }
      ctx.lineTo(z.x1, z.y1); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
      ctx.restore();
    }
    for (const rg of G.rings) {
      const k = clamp(rg.t / rg.dur, 0, 1);
      const r = lerp(rg.r, rg.r1, k);
      ctx.save(); ctx.globalAlpha = clamp(1 - (rg.t - rg.dur * 0.5) / (rg.dur * 0.7), 0, 1);
      ctx.lineWidth = 10 * (1 - k) + 3; ctx.strokeStyle = 'rgba(255,90,110,0.85)'; ctx.beginPath(); ctx.ellipse(rg.x, rg.y, r, r * 0.7, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
  }
  // ボスのガミガミ予告(赤いゾーン)
  function drawDanger(ctx, t) {
    const B = G.boss;
    if (!B || B.state !== 'windup') return;
    const k = 1 - B.st / CONFIG.boss.shout.windup;
    const r = CONFIG.boss.shout.radius;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * 20) * 0.1;
    ctx.fillStyle = 'rgba(255,60,80,0.4)'; ctx.beginPath(); ctx.ellipse(B.x, B.y - 10, r, r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.lineWidth = 4; ctx.strokeStyle = '#ff3b5c'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.ellipse(B.x, B.y - 10, r, r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,60,80,0.5)'; ctx.beginPath(); ctx.ellipse(B.x, B.y - 10, r * k, r * 0.7 * k, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawParticles(ctx) {
    for (const p of G.particles) {
      const a = clamp(p.life / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'star': Art.star(ctx, p.x, p.y, p.size, p.rot, p.color, 0); break;
        case 'spark': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillRect(-p.size * 2.5, -p.size * 0.4, p.size * 5, p.size * 0.8); ctx.restore(); break;
        case 'ring': ctx.lineWidth = 2; ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - a * 0.5), 0, TAU); ctx.stroke(); break;
        case 'dust': ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, 0, 0, TAU); ctx.fill(); break;
        case 'heart': ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.size / 6, p.size / 6); ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-7, -2, -4, -8, 0, -4); ctx.bezierCurveTo(4, -8, 7, -2, 0, 4); ctx.fill(); ctx.restore(); break;
        case 'leaf': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
        case 'box': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); break;
        default: ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawProjectiles(ctx) {
    for (const p of G.projectiles) {
      ctx.save(); ctx.translate(p.x, p.y + 6); ctx.fillStyle = 'rgba(40,50,80,0.25)'; ctx.beginPath(); ctx.ellipse(0, 10, 10, 4, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); Art.drawCabbage(ctx, p.r); ctx.restore();
    }
  }
  function drawTexts(ctx) {
    for (const t of G.texts) {
      const k = t.t / t.life;
      const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : k > 0.75 ? 1.2 - ((k - 0.75) / 0.25) * 0.3 : 1.2;
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc); ctx.rotate((t.vx || 0) * 0.01);
      ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const fs = Math.round(t.size * 1.3);
      ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(5, fs * 0.22); ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
  function drawBubbles(ctx, left, top, right, bottom) {
    const font = `800 18px ${FONT}`;
    // 上の HUD(タイマー・ゲージ)の下から、左右の端まで
    const box = { top: top + 160 / G.view.zoom, left, right };
    for (const w of G.workers) {
      if (!w.speech || w.x < left - 150 || w.x > right + 150 || w.y < top - 100 || w.y > bottom + 60) continue;
      const s = w.speech;
      const a = s.t < 0.15 ? s.t / 0.15 : s.t > s.dur - 0.3 ? Math.max(0, (s.dur - s.t) / 0.3) : 1;
      Art.drawBubble(ctx, w.x, w.y - 86, s.text, s.style, font, a, Object.assign({ sideX: 28 }, box));
    }
    const B = G.boss;
    if (B && B.speech) { const s = B.speech; const a = s.t < 0.15 ? s.t / 0.15 : s.t > s.dur - 0.3 ? Math.max(0, (s.dur - s.t) / 0.3) : 1; Art.drawBubble(ctx, B.x, B.y - 168, s.text, s.style, `800 22px ${FONT}`, a, Object.assign({ sideX: 70 }, box)); }
  }

  // ---------- 1フレーム描く ----------
  function draw(t) {
    const ctx = G.ctx;
    const V = G.view;
    const left = V.left; const top = V.top; const right = left + V.vw; const bottom = top + V.vh;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = TH().outside; ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
    ctx.setTransform(V.zoom * V.dpr, 0, 0, V.zoom * V.dpr, 0, 0);
    const sh = G.cam.shake;
    const sx = sh > 0 ? (Math.random() - 0.5) * sh : 0; const sy = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    ctx.translate(-left + sx, -top + sy);
    drawFloor(ctx, t, left, top, right, bottom);
    drawBelts(ctx, t, left, top, right, bottom);
    drawDanger(ctx, t);
    drawList.length = 0;
    drawWalls(ctx, left, top, right, bottom);
    drawProps(ctx, t, left, top, right, bottom);
    drawWorkers(ctx, t, left, top, right, bottom);
    drawBossEntity(ctx, t);
    if (G.state !== 'title') drawPlayerEntity(ctx, t);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.fn();
    drawProjectiles(ctx);
    drawSwings(ctx);
    drawParticles(ctx);
    drawTexts(ctx);
    drawBubbles(ctx, left, top, right, bottom);
    // 画面効果は CSS オーバーレイで(キャンバスを全面塗りしない)
    if (!fxRed) { fxRed = document.getElementById('fxRed'); fxBlue = document.getElementById('fxBlue'); }
    const r = Math.round((G.redFlash || 0) * 10) / 10; const b = Math.round((G.blueFlash || 0) * 10) / 10;
    if (r !== fxLast.r) { fxRed.style.opacity = r * 0.8; fxLast.r = r; }
    if (b !== fxLast.b) { fxBlue.style.opacity = b * 0.7; fxLast.b = b; }
  }

  // ---------- ミニマップ ----------
  function buildMini() {
    const W = G.world;
    const c = document.createElement('canvas');
    const sc = 240 / W.W;
    c.width = Math.ceil(W.W * sc); c.height = Math.ceil(W.H * sc);
    const g = c.getContext('2d');
    const th = TH();
    g.fillStyle = th.mini; g.fillRect(0, 0, c.width, c.height);
    const COL = { wall: th.frame, belt: '#3a3f4c', table: '#b8c4d4', packIsland: '#b8c4d4', boxes: '#d9a86a', pallet: '#d9a86a', wrap: '#c9a27a', bins: '#3fa65a', tank: '#5ab8e6', rack: '#d0662a' };
    for (const r of W.rects) {
      g.fillStyle = COL[r.type] || '#c77';
      g.fillRect(r.x * sc, r.y * sc, Math.max(1, r.w * sc), Math.max(1, r.h * sc));
    }
    miniBase = { c, sc };
  }
  function drawMini() {
    const mm = G.mini; if (!mm || !miniBase) return;
    const g = mm.getContext('2d');
    const W = G.world;
    const k = mm.width / miniBase.c.width;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, mm.width, mm.height);
    const kk = Math.min(k, mm.height / miniBase.c.height);
    g.drawImage(miniBase.c, 0, 0, miniBase.c.width * kk, miniBase.c.height * kk);
    const s = miniBase.sc * kk;
    const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x * s, y * s, r, 0, TAU); g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke(); };
    for (const p of G.pickups) dot(p.x, p.y, 3.2 * G.view.dpr, CONFIG.harisen[p.type].color);
    if (G.boss && !G.boss.dead) dot(G.boss.x, G.boss.y, 4.5 * G.view.dpr, '#c43ad0');
    // 見えている範囲
    const V = G.view;
    g.strokeStyle = 'rgba(47,42,58,0.6)'; g.lineWidth = 1.5; g.strokeRect(V.left * s, V.top * s, V.vw * s, V.vh * s);
    dot(G.player.x, G.player.y, 3.6 * G.view.dpr, '#e8445a');
  }

  return { resize, draw, drawMini, buildMini, lowerQuality, FONT };
})();
