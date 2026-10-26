'use strict';
/* はじめの画面(Google Play 風: インストールして遊ぶ / このまま遊ぶ)の中身。見本は roguepink/sokai。 */
window.INSTALL_GATE = {
  id: 'ijiwarugame',
  name: 'ハリセン工場パトロール',
  icon: 'icons/icon-192.png',
  color: '#e8445a',
  tagline: '工場の パトロールアクション',
  badges: ['無料', '広告なし', '登録なし', 'スマホは横向き'],
  shots: ['shots/1.jpg', 'shots/2.jpg', 'shots/3.jpg', 'shots/4.jpg', 'shots/5.jpg'],
  desc: '白菜とキャベツの工場で、サボる人・悪口を言う人・じゃまする人を見つけて、ハリセンでたたいて改心させるゲーム。みんなマスクと白い服で、見えるのは目元だけ。最後には イジワルおばさんが やってきます。',
  points: ['目つきと動きで、まじめな人と悪い人を見分ける。まじめな人をたたくとマイナス', 'ジャンボハリセン、ビリビリハリセンが床に落ちている', 'ステージは3つ。タイトルから「おばさんたたき」も遊べる'],
  playLabel: '▶ このまま遊ぶ'
};

/* 部品の install.js(ROGUE PINK 共通の はじめの画面。中身は書きかえない)は、説明書きに script を閉じる字があって
   1ファイルにまとめられないので、ここから 別のファイルとして読みこむ。電波がないときは sw.js が覚えた install.js を使う。
   読みこむまでの一瞬、ゲームの画面が見えてしまわないよう、はじめの画面と同じ色の幕をかけておく(出さないときは かけない)。 */
(function () {
  var C = window.INSTALL_GATE;
  var mm = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var standalone = mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || navigator.standalone === true;
  var hide = false;
  try { hide = localStorage.getItem('ig-' + C.id + '-hide') === '1'; } catch (e) {}
  var cover = null;
  if (!standalone && !hide && !/play|auto|noinstall/.test(location.hash || '')) {
    cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;inset:0;z-index:2147482999;background:rgb(8,6,14)';
    document.body.appendChild(cover);
  }
  var done = function () { if (cover && cover.parentNode) cover.parentNode.removeChild(cover); cover = null; };
  var s = document.createElement('script');
  s.src = 'install.js';
  s.onload = done; s.onerror = done;
  setTimeout(done, 4000);
  document.body.appendChild(s);
})();
