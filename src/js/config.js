'use strict';
/* ゲームバランスの調整値はここにまとめる。遊びながら数字をいじって調整できる */

const CONFIG = {
  tile: 40,
  // 画面の拡大率: 見える面積が targetArea 付近になるよう調整し、最低でも minW x minH は見えるようにする
  view: { targetArea: 260000, minW: 460, minH: 300, maxDpr: 2, maxPixels: 4.5e6 },

  player: {
    r: 15, speed: 235, accel: 2600, maxHp: 100,
    invuln: 0.9,
    comboWindow: 2.6,   // この秒数以内に次を当てるとコンボ継続
  },

  // ハリセン3種。rate: 1秒に振れる回数 / range: とどく距離 / arc: 当たる扇の角度(度) / dmg: 1発のダメージ / kb: ふっとばす強さ
  harisen: {
    normal: { name: 'ふつうのハリセン', short: 'ふつう', rate: 6.5, range: 72, arc: 130, dmg: 1, kb: 150, shake: 4, uses: Infinity, color: '#f6e7c1', edge: '#d8a85a' },
    jumbo:  { name: 'ジャンボハリセン', short: 'ジャンボ', rate: 3.6, range: 112, arc: 180, dmg: 2, kb: 320, shake: 10, uses: 24, color: '#ff8a5c', edge: '#c2452a' },
    spark:  { name: 'ビリビリハリセン', short: 'ビリビリ', rate: 6, range: 78, arc: 130, dmg: 1, kb: 110, shake: 5, uses: 30, color: '#ffe95c', edge: '#c99a00', chain: 150, chainDmg: 1, stun: 1.4 },
  },
  pickup: { first: 14, every: 22, max: 2, life: 40 },

  // 働く人たち
  worker: {
    r: 15, speed: 95, talkEvery: [2.2, 4.5],
    // 改心に必要なヒット数(ハリセンのダメージ合計)
    hp: { slacker: 4, gossip: 5, sabo: 6, minion: 3 },
    score: { hit: 10, reform: 300, goodHit: -200, bossHit: 30, bossDown: 3000, timeBonus: 20 },
    goodHitHp: 8,         // 真面目な人を叩くと、こちらも落ちこんでげんきが減る
    pretendRadius: 170,   // この距離に近づくと(cue>=1) サボりがまじめなふりをする
    retaliateDmg: 8,      // 逆ギレの体当たりダメージ
  },

  boss: {
    r: 26, hp: 30, speed: 100,
    scoldTime: 3.2, seekGap: 1.2,
    shout: { windup: 0.85, radius: 165, dmg: 16, cooldown: 4.5, range: 150 },
    throwCd: 2.4, throwRange: 420, throwSpeed: 380, throwDmg: 10,
    stunHits: 6, stunTime: 1.5,
    weakMul: 2,           // いびっている最中(よそ見)に当てるとダメージ2倍
  },

  // 難易度。cue: 悪い人のヒントの強さ(0: オーラ+目+行動 / 1: 目+行動、近づくとふりをする / 2: 目が細かい、ふりが上手い)
  diff: {
    easy:   { name: 'やさしい', time: 210, hpMul: 0.8,  relapse: 48, cue: 0, bossHpMul: 0.75, retaliate: 0.08, needReform: [4, 6, 8],   badExtra: -1 },
    normal: { name: 'ふつう',   time: 180, hpMul: 1,    relapse: 34, cue: 1, bossHpMul: 1,    retaliate: 0.2, needReform: [5, 8, 11],  badExtra: 0 },
    hard:   { name: 'むずかしい', time: 165, hpMul: 1.3, relapse: 24, cue: 2, bossHpMul: 1.3,  retaliate: 0.35, needReform: [6, 10, 13], badExtra: 1 },
  },

  // ステージ。layout: マップの並び方 / good: まじめな人の数 / bad: 悪い人の内訳(gossip はペア数)
  // timeAdd: 難易度の制限時間に足す秒数 / hpMul: 悪い人の打たれ強さ / theme: 床・壁・ラインの色
  stages: [
    { name: '白菜ライン', layout: 'rows', veg: 'hakusai', lines: 3, W: 2400, H: 1500, good: 10, bad: { slacker: 3, gossip: 1, sabo: 1 }, boxes: 12, relapseMul: 1, timeAdd: 0, hpMul: 1,
      theme: { floorA: '#eef1f6', floorB: '#e6eaf1', grout: 'rgba(150,165,190,0.5)', tile: 80, outside: '#9fb0c8', wall: '#b9c6d8', wallLight: '#d6dfeb', frame: '#8e9bb0', lane: 'rgba(255,200,40,0.55)', sign: '#2a7ad0', lineSign: '#2f6fb8', mini: '#eef1f6' },
      boss: { name: 'イジワルおばさん', hp: 48, speed: 100, throw: false, minions: 0, title: 'ラインの お局' } },
    { name: 'キャベツライン', layout: 'columns', veg: 'cabbage', lines: 6, W: 2800, H: 2050, good: 16, bad: { slacker: 4, gossip: 2, sabo: 3 }, boxes: 16, relapseMul: 0.8, timeAdd: 25, hpMul: 1.15,
      theme: { floorA: '#e2f3e6', floorB: '#d5ecda', grout: 'rgba(110,170,130,0.55)', tile: 60, outside: '#7fae8c', wall: '#8fc29e', wallLight: '#b9dfc3', frame: '#5f9a72', lane: 'rgba(255,255,255,0.85)', sign: '#2f8a4f', lineSign: '#3a9a5a', mini: '#e2f3e6' },
      boss: { name: 'ドイジワルおばさん', hp: 70, speed: 112, throw: true, minions: 0, title: 'キャベツを なげる' } },
    { name: '出荷フロア', layout: 'warehouse', veg: 'mix', lines: 3, W: 3000, H: 2200, good: 22, bad: { slacker: 5, gossip: 3, sabo: 4 }, boxes: 14, relapseMul: 0.65, timeAdd: 50, hpMul: 1.3,
      theme: { floorA: '#e6dfd2', floorB: '#ddd4c4', grout: 'rgba(150,135,110,0.35)', tile: 0, outside: '#a8977c', wall: '#c99a5e', wallLight: '#e2bd8a', frame: '#8a6a44', lane: 'rgba(255,190,20,0.8)', sign: '#b5541f', lineSign: '#c0662a', mini: '#e6dfd2' },
      boss: { name: '大イジワルおばさま', hp: 95, speed: 120, throw: true, minions: 3, title: '工場の ラスボス' } },
  ],
};

// ゲーム全体の状態を入れる入れ物(main.js で初期化する)
const G = {};
