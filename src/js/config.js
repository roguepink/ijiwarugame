'use strict';
/* ゲームバランスの調整値はここにまとめる。遊びながら数字をいじって調整できる */

const CONFIG = {
  tile: 40,
  // 画面の拡大率: 見える面積が targetArea 付近になるよう調整し、最低でも minW x minH は見えるようにする
  view: { targetArea: 330000, minW: 520, minH: 330, maxDpr: 2, maxPixels: 4.5e6 },

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
    easy:   { name: 'やさしい', time: 210, hpMul: 0.8,  relapse: 48, cue: 0, bossHpMul: 0.75, retaliate: 0.08, needReform: [4, 5, 6],  badExtra: -1 },
    normal: { name: 'ふつう',   time: 180, hpMul: 1,    relapse: 34, cue: 1, bossHpMul: 1,    retaliate: 0.2, needReform: [5, 6, 8],  badExtra: 0 },
    hard:   { name: 'むずかしい', time: 165, hpMul: 1.3, relapse: 24, cue: 2, bossHpMul: 1.3,  retaliate: 0.35, needReform: [6, 8, 10], badExtra: 1 },
  },

  // ステージ。lines: ラインの本数 / good: まじめな人の数 / bad: 悪い人の内訳(gossip はペア数)
  stages: [
    { name: '白菜ライン', veg: 'hakusai', lines: 3, W: 2400, good: 10, bad: { slacker: 3, gossip: 1, sabo: 1 }, boxes: 12, relapseMul: 1,
      boss: { name: 'イジワルおばさん', hp: 48, speed: 100, throw: false, minions: 0, title: 'ラインの お局' } },
    { name: 'キャベツライン', veg: 'cabbage', lines: 4, W: 2500, good: 12, bad: { slacker: 3, gossip: 2, sabo: 2 }, boxes: 18, relapseMul: 0.8,
      boss: { name: 'ドイジワルおばさん', hp: 70, speed: 110, throw: true, minions: 0, title: 'キャベツを なげる' } },
    { name: '出荷フロア', veg: 'mix', lines: 4, W: 2700, good: 14, bad: { slacker: 4, gossip: 2, sabo: 3 }, boxes: 24, relapseMul: 0.65,
      boss: { name: '大イジワルおばさま', hp: 95, speed: 118, throw: true, minions: 2, title: '工場の ラスボス' } },
  ],
};

// ゲーム全体の状態を入れる入れ物(main.js で初期化する)
const G = {};
