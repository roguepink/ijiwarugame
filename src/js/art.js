'use strict';
/* 絵づくり。画像ファイルは使わず、すべて Canvas のパスで描く。
   アニメ風にするため「濃いふちどり + ベタ塗り + 2階調の影 + ハイライト」で統一する。
   工場の人はみんな白い衛生服・頭巾・マスクで、見えるのは目元だけ。目つき(mean 0〜1)で善人・悪人を描き分ける */

const Art = (() => {
  const OUT = '#2f2a3a';        // ふちどり(黒ではなく青紫がかった濃色)
  const SUIT = '#fbfbfd';       // 衛生服
  const SUIT_SH = '#d9dde8';    // 衛生服の影
  const GLOVE = '#4fa4e8';
  const MASK = '#eef4fb';
  const SKIN = '#ffd9b8';
  let SC = 2;
  const S = {}; // スプライト置き場

  // ---------- 描画ヘルパー ----------
  function fillStroke(g, fill, lw, stroke) {
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.lineWidth = lw; g.strokeStyle = stroke || OUT; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  function ell(g, x, y, rx, ry, fill, lw = 2, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); fillStroke(g, fill, lw); }
  function circ(g, x, y, r, fill, lw = 2) { g.beginPath(); g.arc(x, y, r, 0, TAU); fillStroke(g, fill, lw); }
  function poly(g, pts, fill, lw = 2) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); fillStroke(g, fill, lw);
  }
  function rrect(g, x, y, w, h, r, fill, lw = 2, stroke) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    fillStroke(g, fill, lw, stroke);
  }
  function star(g, x, y, r, rot, fill, lw = 0) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5; const rr = i % 2 === 0 ? r : r * 0.45; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); fillStroke(g, fill, lw);
  }
  function shadow(g, rx, ry, a = 0.22, ox = 0, oy = 1) {
    g.fillStyle = `rgba(40,50,80,${a})`; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, 0, TAU); g.fill();
  }
  function line(g, x0, y0, x1, y1, col, lw) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

  // 画像(スプライト)を作る。w,h は論理サイズ、(ox,oy) が基準点
  function mk(w, h, ox, oy, draw) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
    const g = c.getContext('2d');
    g.scale(SC, SC); g.translate(ox, oy);
    draw(g);
    return { c, w, h, ox, oy };
  }
  function blit(ctx, s, x, y, sc = 1) { ctx.drawImage(s.c, x - s.ox * sc, y - s.oy * sc, s.w * sc, s.h * sc); }

  // ---------- 野菜 ----------
  function drawCabbage(g, r) {
    circ(g, 0, 0, r, '#7cc24a', 2);
    g.save(); g.beginPath(); g.arc(0, 0, r - 1, 0, TAU); g.clip();
    g.fillStyle = '#5fa534'; g.beginPath(); g.ellipse(r * 0.3, r * 0.35, r * 0.9, r * 0.6, 0.5, 0, TAU); g.fill();
    g.fillStyle = '#a4dd6c'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.3, r * 0.55, r * 0.4, -0.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,90,30,0.45)'; g.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.9; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a) * r * 0.5 + 2, Math.sin(a) * r * 0.5 - 2, Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.14, -0.6, 0, TAU); g.fill();
  }
  function drawHakusai(g, r) {
    // たてに長い。根元は白、先は黄緑
    g.beginPath(); g.ellipse(0, 0, r * 0.62, r, 0, 0, TAU);
    const gr = g.createLinearGradient(0, r, 0, -r); gr.addColorStop(0, '#f6f3dc'); gr.addColorStop(0.55, '#d9ea9a'); gr.addColorStop(1, '#8fc457');
    fillStroke(g, gr, 2);
    g.save(); g.beginPath(); g.ellipse(0, 0, r * 0.62 - 1, r - 1, 0, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(120,150,60,0.4)'; g.lineWidth = 1.2;
    for (const sx of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(sx * r, r * 0.9); g.quadraticCurveTo(sx * r * 1.6, 0, sx * r * 0.8, -r * 0.9); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-r * 0.2, -r * 0.3, r * 0.14, r * 0.3, 0, 0, TAU); g.fill();
    g.restore();
  }
  function drawVeg(g, type, r) { if (type === 'cabbage') drawCabbage(g, r); else drawHakusai(g, r); }

  // ---------- 工場の物(スプライト) ----------
  function buildProps() {
    S.cabbage = mk(44, 44, 22, 22, (g) => drawCabbage(g, 16));
    S.hakusai = mk(36, 52, 18, 26, (g) => drawHakusai(g, 22));
    S.cabbageSmall = mk(30, 30, 15, 15, (g) => drawCabbage(g, 11));
    S.hakusaiSmall = mk(26, 36, 13, 18, (g) => drawHakusai(g, 15));
    // 段ボール箱(1つ)
    S.box = mk(60, 48, 30, 40, (g) => {
      poly(g, [-26, -8, 26, -8, 26, 8, -26, 8], '#d9a86a', 2);      // 正面
      poly(g, [-26, -8, -18, -22, 34, -22, 26, -8], '#e9c389', 2);  // 上面
      poly(g, [26, -8, 34, -22, 34, -6, 26, 8], '#b9844d', 2);      // 側面
      line(g, -4, -22, 4, -8, 'rgba(90,50,20,0.5)', 1.4);
      g.fillStyle = '#9b6a3a'; g.fillRect(-26, -2, 52, 3);         // テープ
      g.fillStyle = '#fff'; g.fillRect(-20, 1, 14, 5); g.fillRect(8, 1, 10, 5); // ラベル
    });
    // 自販機・ロッカー・ベンチ・パレット
    S.vending = mk(56, 100, 28, 86, (g) => {
      shadow(g, 26, 8, 0.25, 2, 4);
      rrect(g, -22, -84, 44, 86, 4, '#e2443c', 2.4);
      rrect(g, -17, -78, 34, 40, 3, '#c8e8ff', 1.6);
      for (let i = 0; i < 6; i++) { const col = ['#ffcf3a', '#5ad0ff', '#ff7aa8', '#8fe07a', '#ffa64d', '#c9a4ff'][i]; rrect(g, -14 + (i % 3) * 11, -74 + Math.floor(i / 3) * 18, 8, 13, 2, col, 1.2); }
      rrect(g, -17, -34, 34, 10, 2, '#2b2b35', 1.4);
      rrect(g, -12, -20, 24, 14, 2, '#8a8a99', 1.6);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-20, -82, 4, 80);
    });
    S.locker = mk(60, 170, 30, 160, (g) => {
      shadow(g, 28, 8, 0.25, 2, 4);
      rrect(g, -24, -156, 48, 158, 3, '#9fb3c8', 2.4);
      for (let i = 0; i < 4; i++) { const y = -152 + i * 38; rrect(g, -20, y, 40, 34, 2, '#b8cbe0', 1.4); g.fillStyle = '#5a6a80'; g.fillRect(-16, y + 4, 12, 2); g.fillRect(-16, y + 8, 12, 2); circ(g, 12, y + 17, 2, '#5a6a80', 0); }
    });
    S.bench = mk(110, 46, 55, 36, (g) => {
      shadow(g, 48, 6, 0.22, 2, 4);
      for (const x of [-40, 36]) rrect(g, x, -14, 6, 18, 2, '#6a6a7a', 1.6);
      rrect(g, -50, -30, 100, 16, 4, '#d7a56a', 2);
      line(g, -46, -22, 46, -22, 'rgba(90,50,20,0.4)', 1.2);
    });
    S.pallet = mk(170, 120, 85, 108, (g) => {
      shadow(g, 80, 10, 0.22, 2, 4);
      rrect(g, -78, -16, 156, 14, 2, '#b58a52', 2);
      for (const dx of [-60, -20, 20]) for (const dy of [-50, -80]) blit(g, S.box, dx, dy, 1);
      for (const dx of [-40, 0, 40]) blit(g, S.box, dx + 10, -30, 1);
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(-78, -40, 156, 24);
    });
    // 作業台(まな板・包丁・野菜)
    S.table = {};
    for (const veg of ['hakusai', 'cabbage']) {
      S.table[veg] = mk(70, 56, 35, 40, (g) => {
        shadow(g, 32, 6, 0.22, 2, 10);
        rrect(g, -29, -30, 58, 30, 3, '#cfd6e0', 2.2);               // ステンレス天板
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-26, -27, 50, 3);
        for (const x of [-25, 21]) rrect(g, x, 0, 5, 12, 1, '#9aa5b5', 1.6); // 脚
        rrect(g, -22, -24, 26, 18, 2, '#f5e4c3', 1.6);               // まな板
        line(g, 4, -26, 20, -14, '#e8edf5', 3.2); line(g, 4, -26, 20, -14, OUT, 1.2); // 包丁
        rrect(g, 18, -16, 7, 7, 2, '#3a3a4a', 1.2);
        g.save(); g.translate(-10, -15); g.scale(0.5, 0.5); drawVeg(g, veg, 16); g.restore();
      });
    }
    // 縦のラインの作業台(細長い)
    S.tableV = {};
    for (const veg of ['hakusai', 'cabbage']) {
      S.tableV[veg] = mk(44, 84, 22, 70, (g) => {
        shadow(g, 18, 6, 0.22, 2, 10);
        rrect(g, -15, -60, 30, 58, 3, '#cfd6e0', 2.2);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-12, -57, 3, 52);
        for (const y of [0]) for (const x of [-12, 8]) rrect(g, x, y - 2, 5, 10, 1, '#9aa5b5', 1.4);
        rrect(g, -11, -52, 22, 26, 2, '#f5e4c3', 1.6);
        line(g, -6, -20, 6, -8, '#e8edf5', 3.2); line(g, -6, -20, 6, -8, OUT, 1.2);
        g.save(); g.translate(0, -40); g.scale(0.5, 0.5); drawVeg(g, veg, 16); g.restore();
      });
    }
    // 小さい段ボール(ベルトに流れる)
    S.boxSmall = mk(36, 30, 18, 24, (g) => {
      poly(g, [-13, -5, 13, -5, 13, 6, -13, 6], '#d9a86a', 1.6);
      poly(g, [-13, -5, -9, -13, 17, -13, 13, -5], '#e9c389', 1.6);
      poly(g, [13, -5, 17, -13, 17, -2, 13, 6], '#b9844d', 1.6);
      g.fillStyle = '#9b6a3a'; g.fillRect(-13, -1, 26, 2);
    });
    // 箱詰め台: 木の台に 組み立て中の段ボールとテープ
    const packTop = (g, w, h) => {
      rrect(g, -w / 2, -h, w, h, 3, '#c99a62', 2.2);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-w / 2 + 3, -h + 3, w - 6, 3);
      g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1; for (let y = -h + 9; y < -2; y += 7) { g.beginPath(); g.moveTo(-w / 2 + 3, y); g.lineTo(w / 2 - 3, y); g.stroke(); }
    };
    const openBox = (g, x, y, sc) => {
      g.save(); g.translate(x, y); g.scale(sc, sc);
      poly(g, [-12, -6, 12, -6, 12, 8, -12, 8], '#d9a86a', 1.6);
      poly(g, [-12, -6, -18, -14, -6, -14, 0, -6], '#e9c389', 1.4);
      poly(g, [12, -6, 18, -14, 6, -14, 0, -6], '#e9c389', 1.4);
      g.fillStyle = '#5a3f22'; g.fillRect(-10, -5, 20, 4);
      g.restore();
    };
    const tape = (g, x, y) => { circ(g, x, y, 4.6, '#e8e2d0', 1.6); circ(g, x, y, 1.8, '#a0947a', 0); };
    S.pack = mk(70, 56, 35, 40, (g) => {
      shadow(g, 32, 6, 0.22, 2, 10);
      packTop(g, 58, 30); g.translate(0, 0);
      for (const x of [-25, 21]) rrect(g, x, 0, 5, 12, 1, '#8a6a44', 1.6);
      g.save(); g.translate(0, -30); openBox(g, -8, 14, 0.9); tape(g, 18, 10); g.restore();
    });
    S.packV = mk(44, 84, 22, 70, (g) => {
      shadow(g, 18, 6, 0.22, 2, 10);
      g.save(); g.translate(0, -2); rrect(g, -15, -58, 30, 58, 3, '#c99a62', 2.2); g.restore();
      for (const x of [-12, 8]) rrect(g, x, -2, 5, 10, 1, '#8a6a44', 1.4);
      openBox(g, 0, -40, 0.75); tape(g, 0, -16);
    });
    S.packIsland = mk(120, 80, 60, 60, (g) => {
      shadow(g, 54, 8, 0.25, 2, 12);
      packTop(g, 100, 44);
      for (const x of [-46, 40]) rrect(g, x, 0, 6, 14, 1, '#8a6a44', 1.6);
      g.save(); g.translate(0, -44); openBox(g, -28, 20, 1); openBox(g, 6, 22, 0.9); tape(g, 34, 16); g.restore();
      // 伝票
      rrect(g, 20, -40, 18, 12, 1.5, '#fff', 1.2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(23, -37, 12, 1.5); g.fillRect(23, -33, 9, 1.5);
    });
    // ラップで巻いた 出荷待ちパレット
    S.wrap = mk(110, 130, 55, 118, (g) => {
      shadow(g, 48, 9, 0.25, 2, 6);
      rrect(g, -45, -14, 90, 14, 2, '#b58a52', 2);
      g.fillStyle = '#8a6438'; for (const x of [-38, -6, 26]) g.fillRect(x, -10, 12, 8);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) blit(g, S.box, -30 + i * 30 + (j % 2) * 3, -16 - j * 26, 1);
      // ラップのつや
      g.fillStyle = 'rgba(220,240,255,0.28)'; g.fillRect(-44, -100, 90, 86);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; for (let y = -96; y < -18; y += 14) { g.beginPath(); g.moveTo(-44, y); g.quadraticCurveTo(0, y + 6, 46, y - 2); g.stroke(); }
      rrect(g, -12, -70, 26, 16, 2, '#fff', 1.4); g.fillStyle = '#c0662a'; g.fillRect(-9, -66, 20, 3); g.fillStyle = '#333'; g.fillRect(-9, -61, 14, 2);
    });
    // ハリセン(床に落ちているもの)
    S.pick = {};
    for (const k of ['normal', 'jumbo', 'spark']) S.pick[k] = mk(90, 70, 45, 40, (g) => { shadow(g, 30, 8, 0.2, 2, 6); g.rotate(-0.5); drawHarisen(g, k, 1); });
    // ぼやけた影
    S.shadowBlob = mk(64, 64, 32, 32, (g) => { const gr = g.createRadialGradient(0, 0, 2, 0, 0, 30); gr.addColorStop(0, 'rgba(40,50,80,0.5)'); gr.addColorStop(0.7, 'rgba(40,50,80,0.25)'); gr.addColorStop(1, 'rgba(40,50,80,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); });
  }
  function softShadow(g, rx, ry, a, ox, oy) {
    if (S.shadowBlob) { g.save(); g.globalAlpha = a / 0.5; g.drawImage(S.shadowBlob.c, ox - rx, oy - ry, rx * 2, ry * 2); g.restore(); return; }
    shadow(g, rx, ry, a, ox, oy);
  }

  // ---------- 大きさが毎回ちがう物 ----------
  // 緑のコンテナを積んだ山(キャベツ入り)
  function drawBins(g, r) {
    const n = r.n || 2;
    const cols = Math.max(1, Math.round(r.w / 46));
    shadow(g, r.w / 2 + 4, 7, 0.22, r.x + r.w / 2, r.y + r.h + 2);
    for (let i = 0; i < cols; i++) for (let j = 0; j < n; j++) {
      const x = r.x + 2 + i * 46 + (j % 2) * 3; const y = r.y + r.h - 26 - j * 22;
      rrect(g, x, y, 42, 24, 3, j % 2 ? '#3fa65a' : '#4cbf68', 2);
      g.fillStyle = 'rgba(20,70,30,0.45)'; for (let k = 0; k < 4; k++) g.fillRect(x + 5 + k * 9, y + 7, 5, 10);
      if (j === n - 1) for (let k = 0; k < 2; k++) { g.save(); g.translate(x + 12 + k * 18, y - 3); g.scale(0.45, 0.45); drawCabbage(g, 16); g.restore(); }
    }
  }
  // 背の高い棚(オレンジの柱・段ボールの段)
  function drawRack(g, r) {
    const H = 104; const x0 = r.x; const x1 = r.x + r.w; const yb = r.y + r.h;
    shadow(g, r.w / 2 + 6, 9, 0.28, r.x + r.w / 2, yb + 2);
    g.fillStyle = 'rgba(60,40,20,0.15)'; g.fillRect(x0, yb - H, r.w, H);
    const rnd = mulberry32(Math.round(r.x * 7 + r.y));
    for (let lv = 0; lv < 3; lv++) {
      const y = yb - 8 - lv * 34;
      for (let x = x0 + 26; x < x1 - 14; x += 34) { if (rnd() < 0.18) continue; blit(g, S.box, x, y, 0.9); }
      rrect(g, x0, y - 2, r.w, 6, 1, '#2f6fb8', 1.6);
    }
    for (let x = x0; x <= x1 - 8; x += Math.max(60, (r.w - 8) / Math.max(1, Math.round(r.w / 120)))) rrect(g, x, yb - H - 6, 8, H + 6, 1.5, '#e07a2a', 1.8);
    rrect(g, x1 - 8, yb - H - 6, 8, H + 6, 1.5, '#e07a2a', 1.8);
  }
  // 洗浄タンク: 水の中でキャベツが ぷかぷか
  function drawTank(g, r, t) {
    shadow(g, r.w / 2 + 6, 8, 0.28, r.x + r.w / 2, r.y + r.h + 2);
    rrect(g, r.x - 6, r.y - 18, r.w + 12, r.h + 18, 10, '#b9c3cf', 2.6);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(r.x - 2, r.y - 14, r.w + 4, 4);
    g.save(); rrect(g, r.x + 4, r.y - 10, r.w - 8, r.h - 6, 8, null, 0); g.clip();
    const gr = g.createLinearGradient(0, r.y - 10, 0, r.y + r.h); gr.addColorStop(0, '#9fdcf5'); gr.addColorStop(1, '#3f9fd8');
    g.fillStyle = gr; g.fillRect(r.x, r.y - 12, r.w, r.h + 8);
    for (let i = 0; i < 5; i++) {
      const x = r.x + 18 + ((i * 29 + t * 18) % (r.w - 30)); const y = r.y + 10 + (i % 2) * 28 + Math.sin(t * 2 + i) * 4;
      g.save(); g.translate(x, y); g.rotate(Math.sin(t + i) * 0.3); g.scale(0.62, 0.62); drawCabbage(g, 16); g.restore();
    }
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const y = r.y + ((t * 20 + i * 22) % (r.h - 6)); g.beginPath(); g.moveTo(r.x + 10, y); g.quadraticCurveTo(r.x + r.w / 2, y + 4, r.x + r.w - 10, y); g.stroke(); }
    for (let i = 0; i < 6; i++) { const bx = r.x + 12 + ((i * 37) % (r.w - 24)); const by2 = r.y + r.h - 10 - ((t * 30 + i * 13) % (r.h - 10)); circ(g, bx, by2, 2.2, 'rgba(255,255,255,0.7)', 0); }
    g.restore();
    rrect(g, r.x + 4, r.y - 10, r.w - 8, r.h - 6, 8, null, 2.2);
    // 出口の じょうご(ベルトへ落ちる)
    poly(g, [r.x + r.w / 2 - 26, r.y + r.h - 4, r.x + r.w / 2 + 26, r.y + r.h - 4, r.x + r.w / 2 + 14, r.y + r.h + 18, r.x + r.w / 2 - 14, r.y + r.h + 18], '#a9b4c2', 2);
  }

  // ---------- ハリセン ----------
  // 持ち手が原点、右(+x)へのびる。sc で大きさ
  function drawHarisen(g, type, sc) {
    const C = CONFIG.harisen[type];
    const big = type === 'jumbo';
    const L = (big ? 66 : 50) * sc; const Wd = (big ? 40 : 26) * sc;
    g.save();
    // 持ち手(テープ巻き)
    rrect(g, -4 * sc, -4 * sc, 22 * sc, 8 * sc, 3 * sc, '#3a3a4a', 1.8);
    for (let i = 0; i < 4; i++) line(g, (i * 5) * sc, -3.5 * sc, (i * 5 + 2) * sc, 3.5 * sc, 'rgba(255,255,255,0.35)', 1.2);
    // 紙の部分: 扇形にひろがる、折り目
    g.beginPath(); g.moveTo(16 * sc, -3 * sc); g.lineTo(L, -Wd / 2); g.quadraticCurveTo(L + 5 * sc, 0, L, Wd / 2); g.lineTo(16 * sc, 3 * sc); g.closePath();
    fillStroke(g, C.color, 2.2);
    g.save(); g.clip();
    g.strokeStyle = C.edge; g.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(18 * sc, i * 0.9 * sc); g.lineTo(L + 4 * sc, i * (Wd / 7)); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(16 * sc, 0, L, Wd);
    if (type === 'spark') { g.fillStyle = '#fff6a8'; for (let i = 0; i < 3; i++) poly(g, [30 * sc + i * 10 * sc, -6 * sc, 36 * sc + i * 10 * sc, -1 * sc, 32 * sc + i * 10 * sc, 1 * sc, 38 * sc + i * 10 * sc, 7 * sc, 30 * sc + i * 10 * sc, 1 * sc, 34 * sc + i * 10 * sc, -1 * sc], '#ffffff', 0); }
    g.restore();
    g.restore();
  }

  // ---------- 目元 ----------
  // 頭巾とマスクのあいだの帯に、目だけを描く。mean: 0=やさしい 1=いじわる。look: 視線 {x,y}
  function drawEyes(g, o) {
    const mean = clamp(o.mean || 0, 0, 1);
    const r = o.r || 14;           // 頭の半径
    const sz = o.size || 1;        // 目の大きさ倍率
    const lx = clamp((o.look && o.look.x) || 0, -1, 1) * 1.6 * sz;
    const ly = clamp((o.look && o.look.y) || 0, -1, 1) * 1.2 * sz;
    const ex0 = r * 0.4; const ey = o.ey || 0;
    const ew = (3.9 * sz) * (1 - mean * 0.12);   // 目の横幅
    const eh = (3.3 * sz) * (1 - mean * 0.55);   // 縦: いじわるほど細い
    const face = o.face || 1;
    if (o.mode === 'closed' || o.mode === 'happy') {
      for (const sx of [-1, 1]) {
        g.strokeStyle = OUT; g.lineWidth = 2 * sz; g.lineCap = 'round';
        g.beginPath();
        if (o.mode === 'happy') { g.moveTo(sx * ex0 - ew, ey + 1); g.quadraticCurveTo(sx * ex0, ey - 3.6 * sz, sx * ex0 + ew, ey + 1); } else { g.moveTo(sx * ex0 - ew, ey); g.quadraticCurveTo(sx * ex0, ey + 2.4 * sz, sx * ex0 + ew, ey); }
        g.stroke();
      }
      drawBrows(g, ex0, ey, ew, mean, sz, face, o);
      return;
    }
    if (o.mode === 'x') { // やられた目
      for (const sx of [-1, 1]) { const ex = sx * ex0; g.strokeStyle = OUT; g.lineWidth = 2.2 * sz; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 3 * sz, ey - 3 * sz); g.lineTo(ex + 3 * sz, ey + 3 * sz); g.moveTo(ex + 3 * sz, ey - 3 * sz); g.lineTo(ex - 3 * sz, ey + 3 * sz); g.stroke(); }
      return;
    }
    if (o.mode === 'spiral') { // 目をまわす
      for (const sx of [-1, 1]) { const ex = sx * ex0; g.strokeStyle = OUT; g.lineWidth = 1.6 * sz; g.beginPath(); for (let a = 0; a < 9; a += 0.3) { const rr = a * 0.42 * sz; const px = ex + Math.cos(a + (o.t || 0) * 6) * rr; const py = ey + Math.sin(a + (o.t || 0) * 6) * rr; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); }
      return;
    }
    for (const sx of [-1, 1]) {
      const ex = sx * ex0 + lx * 0.4;
      // いじわるな目のまわりの暗い影
      if (mean > 0.45) {
        const gr = g.createRadialGradient(ex, ey - eh * 0.4, ew * 0.4, ex, ey - eh * 0.4, ew * 1.9);
        gr.addColorStop(0, `rgba(70,20,90,${0.42 * mean})`); gr.addColorStop(1, 'rgba(70,20,90,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(ex, ey - eh * 0.4, ew * 1.9, eh * 2.6 + 2 * sz, 0, 0, TAU); g.fill();
      }
      // 白目
      g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, TAU); fillStroke(g, o.bloodshot ? '#fff0ec' : mean > 0.6 ? '#fff6d8' : '#fff', (1.6 + mean * 0.6) * sz);
      g.save(); g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, TAU); g.clip();
      // 黒目: いじわるほど小さい
      const pr = (2.3 * sz) * (1 - mean * 0.35);
      circ(g, ex + lx, ey + ly, pr, o.iris || '#3a2a3a', 0);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - pr * 0.4, ey + ly - pr * 0.4, pr * 0.42, 0, TAU); g.fill();
      if (o.mode === 'tear') { g.fillStyle = 'rgba(120,190,255,0.8)'; g.beginPath(); g.ellipse(ex, ey + eh, ew * 0.8, eh * 0.6, 0, 0, TAU); g.fill(); }
      // いじわるな目: 上まぶたが内側へ斜めにかぶさる
      if (mean > 0.15) {
        g.fillStyle = o.skin || SKIN;
        const k = mean;
        const innerDrop = k * eh * 1.25; const outerDrop = k * eh * 0.35;
        const leftY = ey - eh * 1.4 + (sx > 0 ? innerDrop : outerDrop); const rightY = ey - eh * 1.4 + (sx > 0 ? outerDrop : innerDrop);
        g.beginPath(); g.moveTo(ex - ew * 1.2, ey - eh * 1.6); g.lineTo(ex + ew * 1.2, ey - eh * 1.6);
        g.lineTo(ex + ew * 1.2, rightY); g.lineTo(ex - ew * 1.2, leftY); g.closePath(); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 1.5 * sz; g.beginPath(); g.moveTo(ex - ew * 1.05, leftY); g.lineTo(ex + ew * 1.05, rightY); g.stroke();
      }
      if (o.droop) { // ねむそう: まぶたが半分おりる
        g.fillStyle = o.skin || SKIN; g.fillRect(ex - ew - 1, ey - eh - 1, ew * 2 + 2, eh * (0.5 + o.droop * 0.5)); g.strokeStyle = OUT; g.lineWidth = 1.5 * sz; g.beginPath(); g.moveTo(ex - ew, ey - eh + eh * (0.5 + o.droop * 0.5)); g.lineTo(ex + ew, ey - eh + eh * (0.5 + o.droop * 0.5)); g.stroke();
      }
      g.restore();
      if (o.lashes) { // おばさんのまつげ(外側に2本)
        g.strokeStyle = OUT; g.lineWidth = 1.2 * sz; g.lineCap = 'round';
        for (let i = 0; i < 2; i++) { const a = sx > 0 ? -0.9 + i * 0.5 : Math.PI + 0.9 - i * 0.5; g.beginPath(); g.moveTo(ex + Math.cos(a) * ew, ey + Math.sin(a) * eh * 0.9); g.lineTo(ex + Math.cos(a) * (ew + 2.2 * sz), ey + Math.sin(a) * (eh + 2.2 * sz)); g.stroke(); }
      }
      if (o.bags) { g.strokeStyle = 'rgba(90,60,110,0.45)'; g.lineWidth = 1.1 * sz; g.beginPath(); g.moveTo(ex - ew * 0.6, ey + eh + 1.6 * sz); g.quadraticCurveTo(ex, ey + eh + 3.4 * sz, ex + ew * 0.6, ey + eh + 1.6 * sz); g.stroke(); }
      if (o.wrinkles) { g.strokeStyle = 'rgba(90,60,110,0.5)'; g.lineWidth = 1 * sz; for (let i = 0; i <= 1; i++) { g.beginPath(); g.moveTo(ex + sx * (ew + 1.5 * sz), ey + (i - 0.5) * 2.6 * sz); g.lineTo(ex + sx * (ew + 4 * sz), ey + (i - 0.5) * 4.2 * sz); g.stroke(); } }
    }
    drawBrows(g, ex0, ey, ew, mean, sz, face, o);
  }
  function drawBrows(g, ex0, ey, ew, mean, sz, face, o) {
    // まゆ: やさしい=ゆるい弧、いじわる=内側が下がる「ハ」の逆
    const thick = (o.browThick || 1.9) * sz;
    const smirk = o.smirk || 0; // 片まゆ上げ
    for (const sx of [-1, 1]) {
      const ex = sx * ex0;
      const by = ey - (5.6 + (o.browUp || 0)) * sz;
      const inner = ex - sx * ew * 0.9; const outer = ex + sx * ew * 1.05;
      const innerY = by + mean * 4.4 * sz + (smirk && sx === face ? -2.5 * sz : 0);
      const outerY = by - mean * 2.6 * sz + (smirk && sx === face ? 1.5 * sz : 0);
      g.strokeStyle = o.browCol || OUT; g.lineWidth = thick + mean * 1.5 * sz; g.lineCap = 'round';
      g.beginPath(); g.moveTo(inner, innerY); g.quadraticCurveTo((inner + outer) / 2, Math.min(innerY, outerY) - (1 - mean) * 1.6 * sz, outer, outerY); g.stroke();
    }
    if (mean > 0.5 && o.vein) { // こめかみの怒りマーク
      g.strokeStyle = '#c33a7a'; g.lineWidth = 1.6 * sz; g.lineCap = 'round';
      const vx = face * (ex0 + ew + 5 * sz); const vy = ey - 7 * sz;
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { g.beginPath(); g.moveTo(vx + dx * sz * 0.5, vy + dy * sz * 0.5); g.lineTo(vx + dx * sz * 1.3, vy + dy * sz * 1.3); g.stroke(); }
    }
  }

  // ---------- 頭(白い頭巾 + マスク + 目元) ----------
  function drawHoodHead(g, o) {
    const r = o.r || 14;
    const face = o.face || 1;
    // 頭巾: 丸い頭全体を白が覆う、てっぺんは少しふくらむ
    g.beginPath(); g.ellipse(0, 0, r, r * 1.02, 0, 0, TAU); fillStroke(g, o.hood || SUIT, 2.2);
    g.save(); g.beginPath(); g.ellipse(0, 0, r - 1, r * 1.02 - 1, 0, 0, TAU); g.clip();
    g.fillStyle = o.hoodSh || SUIT_SH; g.beginPath(); g.ellipse(r * 0.3, r * 0.2, r * 0.9, r * 1.1, 0, 0, TAU); g.fill();
    g.fillStyle = o.hood || SUIT; g.beginPath(); g.ellipse(-r * 0.15, -r * 0.1, r * 0.78, r * 0.95, 0, 0, TAU); g.fill();
    if (o.perm) { // おばさんパーマが頭巾の下でもこもこ
      g.fillStyle = o.hoodSh || SUIT_SH;
      for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.37; g.beginPath(); g.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8 - r * 0.1, r * 0.22, 0, TAU); g.fill(); }
    }
    // 顔の見える帯(肌色): 目元。頭巾のふちからマスクまで
    g.fillStyle = o.skin || SKIN; g.beginPath(); g.ellipse(0, r * 0.05, r * 0.86, r * 0.52, 0, 0, TAU); g.fill();
    // マスク: 下半分、プリーツ
    g.fillStyle = o.mask || MASK; g.beginPath(); g.moveTo(-r * 0.86, r * 0.38); g.quadraticCurveTo(0, r * 0.24, r * 0.86, r * 0.38); g.lineTo(r * 0.7, r * 0.98); g.quadraticCurveTo(0, r * 1.18, -r * 0.7, r * 0.98); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,80,120,0.35)'; g.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { const y = r * 0.38 + i * r * 0.16; g.beginPath(); g.moveTo(-r * 0.7, y); g.quadraticCurveTo(0, y - r * 0.08, r * 0.7, y); g.stroke(); }
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-r * 0.86, r * 0.38); g.quadraticCurveTo(0, r * 0.24, r * 0.86, r * 0.38); g.stroke();
    // 頭巾のふち(額のライン)
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-r * 0.86, -r * 0.3); g.quadraticCurveTo(0, -r * 0.56, r * 0.86, -r * 0.3); g.stroke();
    g.restore();
    // マスクのひも
    g.strokeStyle = 'rgba(80,100,140,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-r * 0.86, r * 0.42); g.lineTo(-r * 0.99, r * 0.15); g.moveTo(r * 0.86, r * 0.42); g.lineTo(r * 0.99, r * 0.15); g.stroke();
    // マスク越しに口がニヤリと持ち上がる(いじわるな人)
    const em = (o.eyes && o.eyes.mean) || 0;
    if (o.eyes && o.eyes.grin) {
      const k = r / 16;
      g.strokeStyle = 'rgba(70,40,90,0.75)'; g.lineWidth = 1.8 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-r * 0.42 * face, r * 0.7); g.quadraticCurveTo(0, r * 0.84, r * 0.4 * face, r * 0.58); g.lineTo(r * 0.5 * face, r * 0.5); g.stroke();
      g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(r * 0.5 * face, r * 0.62); g.quadraticCurveTo(r * 0.58 * face, r * 0.56, r * 0.55 * face, r * 0.47); g.stroke();
    }
    void em;
    // 目
    g.save(); g.translate(0, r * 0.0); drawEyes(g, Object.assign({ r, face, skin: o.skin || SKIN }, o.eyes || {})); g.restore();
    // ほっぺ(やさしい人だけ)
    if (o.blush) { g.fillStyle = 'rgba(255,120,140,0.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.6, r * 0.27, r * 0.17, r * 0.09, 0, 0, TAU); g.fill(); } }
  }

  // ---------- 作業員(白い衛生服) ----------
  // o: {face, walkT, moving, pose, t, eyes, armband, apron, scale, dizzy}
  function drawWorker(g, o) {
    const t = o.t || 0;
    const face = o.face >= 0 ? 1 : -1;
    const run = !!o.moving;
    const wt = o.walkT || 0;
    const pose = o.pose || 'idle';
    const sc = o.scale || 1;
    const bob = run ? -Math.abs(Math.sin(wt)) * 2.4 : -Math.sin(t * 2) * 0.7;
    softShadow(g, 16 * sc, 6.5 * sc, 0.4, 0, 1);
    g.save();
    g.scale(sc, sc);
    g.translate(0, bob);
    if (pose === 'bow') { g.translate(0, 6); g.scale(1, 0.82); }
    if (pose === 'lean') { g.rotate(-0.14 * face); g.translate(0, 2); }
    // 足(白いズボン・白長ぐつ)
    const swing = run ? Math.sin(wt) : 0;
    const leg = (sx) => {
      const ph = sx * swing;
      const hipX = sx * 4.4; const hipY = -13;
      const stride = run ? ph * 5 : 0;
      const lift = run ? Math.max(0, -ph) * 4 : 0;
      const kneeX = hipX + stride * 0.55; const kneeY = hipY + 6 - lift * 0.5;
      const footX = hipX + stride; const footY = -1 - lift;
      g.strokeStyle = OUT; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      g.strokeStyle = sx === face ? SUIT : SUIT_SH; g.lineWidth = 4.8;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      ell(g, footX + face * 1.2, footY + 1, 5, 3, '#f4f6fa', 1.8); // 長ぐつ
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.beginPath(); g.ellipse(footX + face * 1.2, footY + 2.4, 4.6, 1.1, 0, 0, TAU); g.fill();
    };
    leg(-face); leg(face);
    // 胴体(白い作業服): 丸みのあるカプセル
    g.beginPath(); g.moveTo(-9.5, -14); g.quadraticCurveTo(-11.5, -26, -7, -30); g.lineTo(7, -30); g.quadraticCurveTo(11.5, -26, 9.5, -14); g.quadraticCurveTo(0, -11, -9.5, -14); g.closePath();
    fillStroke(g, SUIT, 2.2);
    g.save(); g.clip();
    g.fillStyle = SUIT_SH; g.beginPath(); g.ellipse(face * 6, -20, 6, 12, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(100,110,140,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -29); g.lineTo(0, -14); g.stroke(); // 前あわせ
    if (o.apron) { g.fillStyle = o.apron; g.beginPath(); g.moveTo(-6, -26); g.lineTo(6, -26); g.lineTo(8, -12); g.lineTo(-8, -12); g.closePath(); g.fill(); }
    if (o.armband) { g.fillStyle = o.armband; g.fillRect(face * 6 - 4, -27, 8, 5); }
    g.restore();
    if (o.badge) { rrect(g, -face * 6 - 2.5, -26, 5, 6, 1, o.badge, 1.2); }
    // うで(手袋)
    const arm = (sx, ax, ay, hx, hy, glove) => {
      const shX = sx * 8.5; const shY = -26;
      g.strokeStyle = OUT; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = SUIT; g.lineWidth = 4;
      g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      circ(g, hx, hy, 3.4, glove || GLOVE, 1.6);
    };
    const armSwing = run ? Math.sin(wt + Math.PI) * 0.7 : 0;
    const chop = Math.max(0, Math.sin(t * 9)) ;
    let eyes = Object.assign({}, o.eyes || {});
    let extra = null;
    switch (pose) {
      case 'work': { // 包丁でトントン(前の手) / 野菜をおさえる
        const k = o.workKind === 'box' ? 0 : 1;
        if (k) { arm(-face, -face * 10, -20, -face * 6, -10, null); arm(face, face * 11, -22 + chop * 4, face * 5, -16 + chop * 7, null); extra = () => { g.save(); g.translate(face * 5, -16 + chop * 7); g.rotate(face * (-0.9 - chop * 0.4)); line(g, 0, 0, 0, -11, '#e8edf5', 3.4); line(g, 0, 0, 0, -11, OUT, 1.2); g.restore(); }; }
        else { const ph = Math.sin(t * 4); arm(-face, -face * 11, -18, -face * 8 + ph * 2, -9, null); arm(face, face * 11, -18, face * 8 + ph * 2, -9, null); extra = () => { g.save(); g.translate(ph * 2, -10); g.scale(0.55, 0.55); drawVeg(g, o.veg || 'cabbage', 16); g.restore(); }; }
        if (!eyes.mode) eyes.look = { x: 0, y: 0.8 };
        break;
      }
      case 'lean': arm(-face, -face * 9, -20, -face * 3, -36, null); arm(face, face * 10, -19, face * 6, -8, null); break;
      case 'phone': arm(-face, -face * 8, -18, -face * 2, -16, null); arm(face, face * 9, -18, face * 3, -15, null); extra = () => { rrect(g, -4, -22, 8, 11, 1.5, '#3a3a4a', 1.4); g.fillStyle = '#bfe8ff'; g.fillRect(-3, -21, 6, 8); g.fillStyle = 'rgba(160,230,255,0.35)'; g.beginPath(); g.ellipse(0, -18, 12, 9, 0, 0, TAU); g.fill(); }; if (!eyes.mode) eyes.look = { x: 0, y: 1 }; break;
      case 'gossip': arm(-face, -face * 9, -19, -face * 4, -12, null); arm(face, face * 9, -22, face * 7, -32, null); if (!eyes.mode) eyes.look = { x: face * 0.9, y: 0.1 }; break;
      case 'bother': { const ph = Math.sin(t * 7); arm(-face, -face * 4, -24, face * 12 + ph * 3, -22, null); arm(face, face * 6, -24, face * 14 + ph * 3, -18, null); if (!eyes.mode) eyes.look = { x: face, y: 0 }; break; }
      case 'bow': arm(-face, -face * 9, -18, -face * 6, -8, null); arm(face, face * 9, -18, face * 6, -8, null); if (!eyes.mode) eyes.mode = 'closed'; break;
      case 'upset': { const ph = Math.sin(t * 12) * 2; arm(-face, -face * 12, -30, -face * 10 + ph, -40, null); arm(face, face * 12, -30, face * 10 - ph, -40, null); break; }
      case 'cry': arm(-face, -face * 8, -18, -face * 3, -30, null); arm(face, face * 8, -18, face * 3, -30, null); if (!eyes.mode) eyes.mode = 'tear'; break;
      case 'pretend': { const ph = Math.sin(t * 14); arm(-face, -face * 11, -18, -face * 8 + ph * 3, -12, null); arm(face, face * 11, -18, face * 8 - ph * 3, -12, null); if (!eyes.mode) eyes.look = { x: -face * 0.8, y: -0.4 }; break; }
      case 'stagger': arm(-face, -face * 12, -28, -face * 14, -34, null); arm(face, face * 12, -28, face * 14, -34, null); if (!eyes.mode) eyes.mode = 'x'; break;
      case 'dizzy': arm(-face, -face * 11, -22, -face * 12, -14, null); arm(face, face * 11, -22, face * 12, -14, null); if (!eyes.mode) eyes.mode = 'spiral'; break;
      default: // idle / walk
        arm(-face, -face * 9 + Math.sin(armSwing) * 3, -19, -face * 7 + Math.sin(armSwing) * 6, -10 + Math.abs(Math.sin(armSwing)) * 3, null);
        arm(face, face * 9 - Math.sin(armSwing) * 3, -19, face * 7 - Math.sin(armSwing) * 6, -10 + Math.abs(Math.sin(armSwing)) * 3, null);
    }
    if (extra) extra();
    // 頭
    g.save();
    const hx = face * 1.2 + (run ? face * 0.8 : 0);
    g.translate(hx, -46 + (run ? Math.sin(wt * 2) * 0.6 : 0));
    if (pose === 'bow') g.translate(0, 5);
    eyes.t = t;
    if (eyes.size == null) eyes.size = 1.7;
    drawHoodHead(g, { r: 22, face, eyes, blush: o.blush, badge: o.badge });
    g.restore();
    g.restore();
    // 頭の上のしるし
    if (o.marker) o.marker(g, bob);
    if (pose === 'dizzy' || o.dizzy) { for (let i = 0; i < 3; i++) { const a = t * 5 + (i * TAU) / 3; star(g, Math.cos(a) * 17 * sc, (-74 + bob) * sc + Math.sin(a) * 3, 4.4, a, '#ffe14d', 1.4); } }
  }

  // ---------- 主人公(パトロール) ----------
  function drawPlayer(g, P, t) {
    const face = Math.cos(P.aim) >= 0 ? 1 : -1;
    const run = P.moving;
    const wt = P.walkT;
    const bob = run ? -Math.abs(Math.sin(wt)) * 2.6 : -Math.sin(t * 2.2) * 0.8;
    const hurt = P.hurtT > 0;
    softShadow(g, 17, 7, 0.4, 0, 1);
    g.save();
    g.translate(0, bob);
    const lean = run ? Math.sign(P.vx || 0) * clamp(Math.hypot(P.vx, P.vy) / 300, 0, 1) * 0.07 : 0;
    g.rotate(lean);
    // 足
    const swing = run ? Math.sin(wt) : 0;
    const leg = (sx) => {
      const ph = sx * swing;
      const hipX = sx * 4.4; const hipY = -13;
      const stride = run ? ph * 5.5 : 0;
      const lift = run ? Math.max(0, -ph) * 4.5 : 0;
      const kneeX = hipX + stride * 0.55; const kneeY = hipY + 6 - lift * 0.5;
      const footX = hipX + stride; const footY = -1 - lift;
      g.strokeStyle = OUT; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      g.strokeStyle = sx === face ? SUIT : SUIT_SH; g.lineWidth = 4.8;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY); g.stroke();
      ell(g, footX + face * 1.2, footY + 1, 5.2, 3.1, '#f4f6fa', 1.8);
      g.fillStyle = '#e8445a'; g.fillRect(footX + face * 1.2 - 4, footY - 0.4, 8, 1.4);
    };
    leg(-face); leg(face);
    // 胴
    g.beginPath(); g.moveTo(-9.8, -14); g.quadraticCurveTo(-12, -26, -7, -30.5); g.lineTo(7, -30.5); g.quadraticCurveTo(12, -26, 9.8, -14); g.quadraticCurveTo(0, -11, -9.8, -14); g.closePath();
    fillStroke(g, SUIT, 2.2);
    g.save(); g.clip();
    g.fillStyle = SUIT_SH; g.beginPath(); g.ellipse(face * 6, -20, 6, 12, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(100,110,140,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -29); g.lineTo(0, -14); g.stroke();
    // 赤い腕章「パト」
    g.fillStyle = '#e8445a'; g.fillRect(-face * 10 - 1, -27.5, 7, 5.5);
    g.fillStyle = '#fff'; g.fillRect(-face * 10 + 0.5, -26, 4, 2.5);
    g.restore();
    // ハリセンを持つ手と、空いている手
    const sw = P.swingT > 0 ? 1 - P.swingT / P.swingDur : -1; // 0→1 で振り切る
    const dir = P.swingDir || 1;
    const baseA = P.aim;
    let fanA;
    if (sw >= 0) { const e = 1 - Math.pow(1 - sw, 2.2); fanA = baseA + dir * (-1.3 + 2.4 * e); } else { fanA = baseA + dir * 1.0 * (0.4 + Math.sin(t * 2.2) * 0.08); }
    const handX = Math.cos(fanA) * 13; const handY = -22 + Math.sin(fanA) * 7;
    const freeArm = (sx) => {
      const shX = sx * 8.5; const shY = -26;
      const as = run ? Math.sin(wt + Math.PI) * 0.7 : Math.sin(t * 2.2) * 0.05;
      const ax = shX + sx * 2 + Math.sin(as) * 4; const ay = shY + 6; const hxx = ax + sx * 0.5 + Math.sin(as) * 5; const hyy = ay + 6 - Math.abs(Math.sin(as)) * 3;
      g.strokeStyle = OUT; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hxx, hyy); g.stroke();
      g.strokeStyle = SUIT; g.lineWidth = 4; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hxx, hyy); g.stroke();
      circ(g, hxx, hyy, 3.4, GLOVE, 1.6);
    };
    const fanArm = () => {
      const shX = face * 8.5; const shY = -26;
      const ex = (shX + handX) / 2 + face * 3; const ey = (shY + handY) / 2 + 2;
      g.strokeStyle = OUT; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ex, ey); g.lineTo(handX, handY); g.stroke();
      g.strokeStyle = SUIT; g.lineWidth = 4; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ex, ey); g.lineTo(handX, handY); g.stroke();
      g.save(); g.translate(handX, handY); g.rotate(fanA);
      drawHarisen(g, P.harisen, 1);
      g.restore();
      circ(g, handX, handY, 3.6, GLOVE, 1.6);
    };
    const fanBehind = Math.sin(fanA) < -0.3;
    if (fanBehind) fanArm();
    freeArm(-face);
    // 頭
    g.save();
    g.translate(face * 1.2 + (run ? face * 0.8 : 0), -46.5 + (run ? Math.sin(wt * 2) * 0.6 : 0));
    const look = { x: Math.cos(P.aim), y: Math.sin(P.aim) };
    const eyes = hurt ? { mode: 'x', size: 1.7 } : (P.sadT > 0 ? { mode: 'tear', look, browUp: 1, size: 1.7 } : { mean: 0, look, size: 1.72, mode: (P.happyT > 0 ? 'happy' : undefined) });
    eyes.t = t;
    drawHoodHead(g, { r: 22, face, eyes, blush: true, hood: '#ffffff' });
    // 「パトロール」の帽子マーク(頭巾の上の赤いライン)
    g.strokeStyle = '#e8445a'; g.lineWidth = 3.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-13.5, -13); g.quadraticCurveTo(0, -19, 13.5, -13); g.stroke();
    g.restore();
    if (!fanBehind) fanArm();
    g.restore();
    if (P.stunT > 0) { for (let i = 0; i < 3; i++) { const a = t * 5 + (i * TAU) / 3; star(g, Math.cos(a) * 17, -74 + bob + Math.sin(a) * 3, 4.4, a, '#ffe14d', 1.4); } }
  }

  // ---------- 悪い人のまわりの暗いトーン(スクリーントーン風) ----------
  function drawTone(g, r, a, t) {
    g.save();
    const gr = g.createRadialGradient(0, -r * 0.6, r * 0.3, 0, -r * 0.6, r * 1.6);
    gr.addColorStop(0, `rgba(70,20,90,${a * 0.7})`); gr.addColorStop(0.6, `rgba(70,20,90,${a * 0.45})`); gr.addColorStop(1, 'rgba(70,20,90,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, -r * 0.6, r * 1.6, 0, TAU); g.fill();
    // 斜線のトーン
    g.beginPath(); g.arc(0, -r * 0.6, r * 1.45, 0, TAU); g.clip();
    g.strokeStyle = `rgba(40,10,60,${a * 0.5})`; g.lineWidth = 1.3;
    const off = (t * 10) % 8;
    for (let x = -r * 2; x < r * 2; x += 8) { g.beginPath(); g.moveTo(x + off, -r * 2.4); g.lineTo(x + off - r * 1.6, r * 1.2); g.stroke(); }
    g.restore();
  }

  // ---------- ボス: イジワルおばさん ----------
  // 顔がとても大きい。まわりに暗いトーン。目だけでも悪さがわかる
  function drawBoss(g, B, t) {
    const face = B.face >= 0 ? 1 : -1;
    const run = B.moving;
    const wt = B.walkT || 0;
    const R = 44 * (B.size || 1);          // 頭の半径(作業員の 2 倍以上)
    const bob = run ? -Math.abs(Math.sin(wt)) * 3 : -Math.sin(t * 1.8) * 1;
    const lvl = B.level || 0;
    // トーン(いびり中・怒り中は濃い)
    const toneA = (B.state === 'defeated' ? 0.06 : B.state === 'scold' || B.state === 'windup' ? 0.42 : 0.3) * (B.toneMul == null ? 1 : B.toneMul);
    if (toneA > 0) { g.save(); g.translate(0, -10); drawTone(g, R * 1.1, toneA, t); g.restore(); }
    if (!B.noShadow) softShadow(g, 32, 12, 0.45, 0, 2);
    g.save();
    g.scale(1.15, 1.15); // ひと回り大きい
    g.translate(0, bob);
    if (B.state === 'defeated') { g.translate(0, 8); g.scale(1, 0.84); }
    const swing = run ? Math.sin(wt) : 0;
    const leg = (sx) => {
      const ph = sx * swing;
      const hipX = sx * 7; const hipY = -16;
      const stride = run ? ph * 6 : 0; const lift = run ? Math.max(0, -ph) * 4 : 0;
      const footX = hipX + stride; const footY = -1 - lift;
      g.strokeStyle = OUT; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(footX, footY); g.stroke();
      g.strokeStyle = sx === face ? SUIT : SUIT_SH; g.lineWidth = 6.4; g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(footX, footY); g.stroke();
      ell(g, footX + face * 1.5, footY + 1, 7, 4, '#f4f6fa', 2);
    };
    leg(-face); leg(face);
    // 胴(どっしり)
    g.beginPath(); g.moveTo(-16, -16); g.quadraticCurveTo(-20, -34, -11, -40); g.lineTo(11, -40); g.quadraticCurveTo(20, -34, 16, -16); g.quadraticCurveTo(0, -12, -16, -16); g.closePath();
    fillStroke(g, SUIT, 2.4);
    g.save(); g.clip();
    g.fillStyle = SUIT_SH; g.beginPath(); g.ellipse(face * 9, -26, 9, 16, 0, 0, TAU); g.fill();
    g.fillStyle = B.apron || (lvl >= 2 ? '#b03a8a' : lvl === 1 ? '#c2503a' : '#7a3a9a'); g.beginPath(); g.moveTo(-9, -36); g.lineTo(9, -36); g.lineTo(12, -16); g.lineTo(-12, -16); g.closePath(); g.fill(); // 色つきエプロン(主任)
    g.fillStyle = B.badge || '#ffd24d'; g.fillRect(-face * 14 - 3, -36, 7, 6); // 金のバッジ
    g.restore();
    // うで: 指示棒 / 腰に手
    const arm = (sx, ax, ay, hx, hy) => {
      const shX = sx * 14; const shY = -34;
      g.strokeStyle = OUT; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = SUIT; g.lineWidth = 5.4; g.beginPath(); g.moveTo(shX, shY); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      circ(g, hx, hy, 4.4, '#ff9ab8', 1.8); // ピンクの手袋
    };
    const st = B.state;
    if (st === 'scold' || st === 'windup' || st === 'shout') {
      const ph = Math.sin(t * (st === 'scold' ? 9 : 16)) * 4;
      arm(-face, -face * 20, -30, -face * 16, -18, null);
      arm(face, face * 18, -40, face * 30 + ph, -46 + ph, null);
      g.save(); g.translate(face * 30 + ph, -46 + ph); g.rotate(face * -0.6 + ph * 0.05); line(g, 0, 0, 0, -24, '#ff6a6a', 3.6); line(g, 0, 0, 0, -24, OUT, 1.4); circ(g, 0, -24, 3, '#ff6a6a', 1.4); g.restore();
    } else if (st === 'throw') {
      const k = clamp(B.st / 0.5, 0, 1);
      arm(-face, -face * 20, -30, -face * 16, -18, null);
      arm(face, face * 16, -44, face * (8 + k * 24), -58 + k * 20, null);
      if (k < 0.5) { g.save(); g.translate(face * (8 + k * 24), -62 + k * 20); drawCabbage(g, 11); g.restore(); }
    } else if (st === 'stun' || st === 'stagger') {
      arm(-face, -face * 20, -34, -face * 24, -24, null); arm(face, face * 20, -34, face * 24, -24, null);
    } else if (st === 'defeated') {
      arm(-face, -face * 14, -26, -face * 10, -12, null); arm(face, face * 14, -26, face * 10, -12, null);
    } else {
      arm(-face, -face * 20, -30, -face * 16, -18, null); // 腰に手
      arm(face, face * 20, -30, face * 16, -18, null);
    }
    // 頭(とても大きい)
    g.save();
    g.translate(face * 1.5, -40 - R * 0.75 + (run ? Math.sin(wt * 2) * 0.8 : 0));
    let eyes;
    if (st === 'stun') eyes = { mode: 'spiral', size: R / 14 };
    else if (st === 'stagger') eyes = { mode: 'x', size: R / 14 };
    else if (st === 'defeated') eyes = { mode: 'tear', mean: 0.1, size: R / 14, browUp: 2, lashes: true, bags: true };
    else {
      const look = B.look || { x: face * 0.6, y: 0.2 };
      const mean = B.mean != null ? B.mean : 0.9;
      eyes = { mean: st === 'scold' || st === 'windup' ? Math.min(1, mean + 0.1) : mean, grin: B.grin != null ? B.grin : true, look, size: R / 14, lashes: B.lashes != null ? B.lashes : true, bags: B.bags != null ? B.bags : true, wrinkles: B.wrinkles != null ? B.wrinkles : true, bloodshot: st === 'windup' || st === 'shout' || !!B.bloodshot, vein: st === 'scold' || st === 'windup' || B.hitFlash > 0 || !!B.vein, smirk: st === 'seek' || st === 'enter' ? 1 : 0, browThick: B.browThick || 2.1 };
    }
    eyes.t = t;
    drawHoodHead(g, { r: R, face, eyes, perm: true, mask: B.mask || (lvl >= 1 ? '#ffe4ec' : MASK), skin: B.skin || '#f3cfae', hood: B.hood, hoodSh: B.hoodSh });
    // ほうれい線はマスクで見えないので、こめかみのシワと眉間のシワ
    g.strokeStyle = 'rgba(90,60,110,0.6)'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3, -R * 0.12); g.lineTo(-1.5, R * 0.06); g.moveTo(3, -R * 0.12); g.lineTo(1.5, R * 0.06); g.stroke();
    g.restore();
    g.restore();
    if (st === 'stun') { for (let i = 0; i < 4; i++) { const a = t * 5 + (i * TAU) / 4; star(g, Math.cos(a) * 26, -40 - R * 1.5 + bob + Math.sin(a) * 5, 5, a, '#ffe14d', 1.4); } }
  }

  // ---------- ふきだし ----------
  // style: 'talk' | 'whisper' | 'shout' | 'think'
  // box: {top, left, right} を渡すと、ふきだしがその範囲(画面内)に収まるようにずらす
  function drawBubble(ctx, x, y, text, style, font, alpha, box) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pad = 8;
    const lines = String(text).split('\n');
    let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    const px = (String(font).match(/(\d+(?:\.\d+)?)px/) || [0, 13])[1];
    const lh = Math.round(parseFloat(px) * 1.3) || 16;
    const h = lh * lines.length + pad * 1.2;
    w += pad * 2.2;
    if (box) {
      // 上にはみ出すときは下げる。下げると顔に重なるので、そのぶん横へよける
      if (y - h - 8 < box.top) {
        const ny = box.top + h + 8;
        if (box.sideX && ny - y > 20) { const dir = x + box.sideX + w < box.right ? 1 : -1; x += dir * (box.sideX + w / 2); }
        y = ny;
      }
      x = clamp(x, box.left + w / 2 + 8, box.right - w / 2 - 8);
    }
    const bx = x - w / 2; const by = y - h;
    ctx.lineJoin = 'round';
    if (style === 'shout') {
      // ギザギザ
      ctx.beginPath();
      const n = 18; const cx = x; const cy = y - h / 2;
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const rr = i % 2 ? 1.0 : 1.22; ctx.lineTo(cx + Math.cos(a) * (w / 2 + 6) * rr, cy + Math.sin(a) * (h / 2 + 6) * rr); }
      ctx.closePath(); ctx.fillStyle = '#fff3f3'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a0203a'; ctx.stroke();
      ctx.fillStyle = '#a0203a';
    } else if (style === 'think') {
      ctx.beginPath(); ctx.ellipse(x, y - h / 2, w / 2 + 2, h / 2 + 4, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.stroke();
      circ(ctx, x - 6, y + 6, 3.5, '#fff', 2); circ(ctx, x - 10, y + 13, 2, '#fff', 1.6);
      ctx.fillStyle = OUT;
    } else {
      const dashed = style === 'whisper';
      if (dashed) ctx.setLineDash([4, 3]);
      rrect(ctx, bx, by, w, h, 9, dashed ? 'rgba(255,255,255,0.92)' : '#fff', 2.4, dashed ? '#6a4a8a' : OUT);
      ctx.setLineDash([]);
      // しっぽ
      ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x, y + 8); ctx.lineTo(x + 6, y - 1); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = dashed ? '#6a4a8a' : OUT; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 3, 10, 3);
      ctx.fillStyle = dashed ? '#5a3a7a' : OUT;
    }
    const ty = y - h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, ty + i * lh));
    ctx.restore();
  }

  // 画面の大きさが変わるたびに全部描き直すと重いので、倍率ごとに作った絵を取っておいて使い回す
  const cache = new Map();
  function init(sc) {
    SC = sc;
    if (cache.has(sc)) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, cache.get(sc)); return; }
    for (const k of Object.keys(S)) delete S[k];
    buildProps();
    cache.set(sc, Object.assign({}, S));
  }
  return { init, S, OUT, SUIT, GLOVE, drawBins, drawRack, drawTank, drawWorker, drawPlayer, drawBoss, drawHarisen, drawBubble, drawVeg, drawCabbage, drawHakusai, drawTone, drawHoodHead, blit, mk, rrect, circ, ell, star, poly, fillStroke, softShadow, line };
})();
