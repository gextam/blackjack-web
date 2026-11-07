/* ============================================================================
   BLACKJACK — bootstrap, frame loop, test hooks.
   ?mute=1 silent · ?fast=1 quick animations · ?h17=1 dealer hits soft 17
   BJ.step(seconds) advances the virtual clock; BJ.game.forced = ['A','K',...]
   serves those ranks next from the shoe (used by tools/smoke.mjs).
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ;
  root.addEventListener('load', () => {
    const q = new URLSearchParams(root.location.search);
    const canvas = document.getElementById('game');
    const game = new BJ.Game();
    if (q.get('h17')) game.rules.hitSoft17 = true;
    if (q.get('fast')) Object.assign(game.timing, { deal: 0.12, botThink: 0.25, dealerDraw: 0.3, settleHold: 1.2 });
    const renderer = new BJ.Renderer(canvas, game); game.renderer = renderer;
    const ui = new BJ.UI(game, renderer); game.ui = ui;
    BJ.game = game; BJ.renderer = renderer; BJ.ui = ui;
    ui.buildHelp();
    Object.keys(BJ.LINES).forEach(k => BJ.audio.preloadClip(k, 'assets/audio/' + k + '.mp3'));
    const files = { bg: 'assets/bg/room.jpg', logo: 'assets/logo.png' };
    ['J', 'Q', 'K'].forEach(r => ['S', 'H', 'D', 'C'].forEach(s => { files[r + s] = 'assets/cards/' + r + s + '.png'; }));
    renderer.loadImages(files).then(() => ui.assetsLoaded());

    BJ.timeOffset = 0;
    const clock = () => performance.now() / 1000 + BJ.timeOffset;
    let last = clock();
    function tick(now, dt, draw) { game.update(now, dt); root.ZEUS.fx.update(dt); renderer.update(dt); if (draw) { renderer.draw(now); ui.refresh(); } }
    function frame() { const now = clock(), dt = Math.min(0.05, Math.max(0, now - last)); last = now; tick(now, dt, true); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    BJ.step = function (seconds) { const h = 1 / 60, n = Math.max(1, Math.round(seconds / h)); for (let i = 0; i < n; i++) { BJ.timeOffset += h; const now = clock(); last = now; tick(now, h, i === n - 1); } };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && BJ.audio.ctx) BJ.audio.ctx.resume(); });
  });
})(window);
