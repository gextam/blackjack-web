/* ============================================================================
   BLACKJACK — DOM: dealer panel, bankroll and bet readouts, chips, action
   buttons with basic-strategy hints, count panel, help, splash, keyboard,
   canvas seat selection.
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ, L = BJ.LAYOUT;
  const $ = id => document.getElementById(id);
  const A = () => BJ.audio;
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function UI(game, renderer) {
    this.game = game; this.renderer = renderer;
    this.el = { canvas: $('game'), caption: $('caption'), bankroll: $('bankroll'), bet: $('bet'), message: $('message'), chips: Array.from(document.querySelectorAll('#tray .chip')),
      deal: $('btn-deal'), clear: $('btn-clear'), rebet: $('btn-rebet'), hit: $('btn-hit'), stand: $('btn-stand'), dbl: $('btn-double'), split: $('btn-split'), surr: $('btn-surrender'), insYes: $('btn-ins-yes'), insNo: $('btn-ins-no'), buyin: $('btn-buyin'),
      seat2: $('btn-seat2'), hint: $('btn-hint'), count: $('btn-count'), help: $('btn-help'), sound: $('btn-sound'), vol: $('vol'), hintText: $('hint-text'), countPanel: $('count'), rc: $('rc'), tc: $('tc'), decks: $('decks'),
      helpBox: $('help'), helpClose: $('help-close'), helpBody: $('help-body'), splash: $('splash'), splashText: $('splash-text') };
    this.splashVisible = true; this.ready = false; this.helpOpen = false;
    this.bind();
  }
  const P = UI.prototype;
  P.bind = function () {
    const g = this.game, e = this.el;
    const press = (el, fn) => el && el.addEventListener('click', ev => { ev.preventDefault(); A().init(); fn(); });
    e.chips.forEach(ch => press(ch, () => { g.chip = parseInt(ch.dataset.v, 10); A().uiTick(); g.addBet(g.chip); this.refreshChips(); }));
    press(e.deal, () => g.deal()); press(e.clear, () => g.clearBet()); press(e.rebet, () => g.rebet());
    press(e.hit, () => g.act('hit')); press(e.stand, () => g.act('stand')); press(e.dbl, () => g.act('double')); press(e.split, () => g.act('split')); press(e.surr, () => g.act('surrender'));
    press(e.insYes, () => g.insuranceDecision(true)); press(e.insNo, () => g.insuranceDecision(false));
    press(e.buyin, () => g.addCredits(500));
    press(e.seat2, () => g.toggleSecondSeat());
    press(e.hint, () => { g.hint = !g.hint; A().uiTick(); e.hint.classList.toggle('on', g.hint); });
    press(e.count, () => { g.showCount = !g.showCount; A().uiTick(); e.count.classList.toggle('on', g.showCount); e.countPanel.classList.toggle('hidden', !g.showCount); });
    press(e.help, () => { A().uiTick(); this.toggleHelp(); }); press(e.helpClose, () => { A().uiTick(); this.toggleHelp(false); });
    press(e.sound, () => { const m = A().toggleMute(); this.updateSound(); if (!m) A().uiTick(); });
    e.vol.addEventListener('input', () => { A().init(); A().setVolume(parseFloat(e.vol.value)); if (A().muted) { A().setMuted(false); this.updateSound(); } });
    e.splash.addEventListener('pointerdown', () => { if (this.ready) this.start(); });
    e.canvas.addEventListener('click', ev => {
      if (this.splashVisible) return; A().init();
      const x = ev.offsetX, y = ev.offsetY;
      for (let i = 0; i < L.SEAT_POS.length; i++) { const p = L.SEAT_POS[i]; if (Math.hypot((x - p.x) / 1.3, y - p.y) < 46) { const s = g.seats[i]; if (s.human) { if (!s.active && s.optional) g.toggleSecondSeat(); else if (g.selectSeat(i)) { if (g.state === 'betting') g.addBet(g.chip, i); A().uiTick(); } } return; } }
    });
    root.addEventListener('keydown', ev => {
      if (ev.repeat) return;
      if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); A().init(); if (this.splashVisible) { if (this.ready) this.start(); } else if (this.helpOpen) this.toggleHelp(false); else if (g.state === 'betting') g.deal(); else if (g.state === 'playing') g.act('hit'); return; }
      if (this.splashVisible) return; A().init();
      switch (ev.code) {
        case 'KeyD': if (g.state === 'betting') g.deal(); else g.act('double'); break;
        case 'KeyH': g.act('hit'); break; case 'KeyS': g.act('stand'); break; case 'KeyX': g.act('double'); break; case 'KeyP': g.act('split'); break; case 'KeyR': g.act('surrender'); break;
        case 'KeyY': g.insuranceDecision(true); break; case 'KeyN': g.insuranceDecision(false); break;
        case 'KeyC': g.clearBet(); break; case 'KeyB': g.rebet(); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': { const i = parseInt(ev.code.slice(5), 10) - 1; g.chip = BJ.CHIPS[i].value; g.addBet(g.chip); this.refreshChips(); break; }
        case 'KeyT': e.hint.click(); break; case 'KeyK': e.count.click(); break; case 'Slash': this.toggleHelp(); break; case 'KeyM': A().toggleMute(); this.updateSound(); break; case 'Escape': this.toggleHelp(false); break;
        default: break;
      }
    });
    e.vol.value = A().volume; this.updateSound(); this.refreshChips();
  };
  P.start = function () { A().init(); this.splashVisible = false; this.el.splash.classList.add('hidden'); this.game.begin(); };
  P.assetsLoaded = function () { this.ready = true; this.el.splashText.textContent = 'TAKE A SEAT'; this.el.splash.classList.add('ready'); };
  P.caption = function (text) { this.el.caption.textContent = text; this.el.caption.classList.toggle('show', !!text); };
  P.refreshChips = function () { this.el.chips.forEach(ch => ch.classList.toggle('sel', parseInt(ch.dataset.v, 10) === this.game.chip)); };
  function set(el, text) { if (el && el._t !== text) { el._t = text; el.textContent = text; } }
  P.refresh = function () {
    const g = this.game, e = this.el, st = g.state, you = g.human(), sel = g.seats[g.selectedSeat] || you;
    set(e.bankroll, fmt(you.shown + (g.seats[3].active ? g.seats[3].shown : 0))); set(e.bet, fmt(sel.bet || (sel.hands ? sel.hands.reduce((a, h) => a + h.bet, 0) : 0)));
    set(e.message, g.message);
    const betting = st === 'betting', playing = st === 'playing' && g.turn && g.seats[g.turn.seat].human && !g.pendingAct, ins = st === 'insurance';
    const o = playing ? g.options(g.turn.seat, g.turn.hand) : {};
    e.deal.disabled = !betting; e.clear.disabled = !betting; e.rebet.disabled = !betting; e.buyin.disabled = !betting; e.seat2.disabled = !betting;
    e.hit.disabled = !playing; e.stand.disabled = !playing; e.dbl.disabled = !(playing && o.double); e.split.disabled = !(playing && o.split); e.surr.disabled = !(playing && o.surrender);
    e.insYes.classList.toggle('hidden', !ins); e.insNo.classList.toggle('hidden', !ins);
    e.deal.classList.toggle('pulse', betting && you.bet >= g.rules.minBet);
    set(e.seat2, g.seats[3].active ? 'CLOSE 2ND SEAT' : 'OPEN 2ND SEAT');
    const names = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' }; let hintCode = null;
    [e.hit, e.stand, e.dbl, e.split, e.surr].forEach(b => b.classList.remove('hint'));
    if (playing && g.hint) { hintCode = g.hintFor(g.turn.seat, g.turn.hand); const map = { H: e.hit, S: e.stand, D: e.dbl, P: e.split, R: e.surr }; if (map[hintCode] && !map[hintCode].disabled) map[hintCode].classList.add('hint'); }
    set(e.hintText, playing && g.hint && hintCode ? 'BASIC STRATEGY: ' + names[hintCode].toUpperCase() : (ins && g.hint ? 'BASIC STRATEGY: DECLINE INSURANCE' : ''));
    set(e.rc, (g.runningCount > 0 ? '+' : '') + g.runningCount); const tc = g.trueCount(); set(e.tc, (tc > 0 ? '+' : '') + tc.toFixed(1)); set(e.decks, g.decksLeft().toFixed(1));
  };
  P.updateSound = function () { this.el.sound.textContent = A().muted ? '🔇' : '🔊'; this.el.sound.classList.toggle('muted', A().muted); };
  P.toggleHelp = function (force) { const open = force == null ? !this.helpOpen : force; this.helpOpen = open; this.el.helpBox.classList.toggle('hidden', !open); };
  P.buildHelp = function () {
    const r = this.game.rules;
    const rows = [['Decks in the shoe', r.decks + ' (cut card with ' + r.penetrationDecks + ' decks left)'], ['Dealer', r.hitSoft17 ? 'hits soft 17' : 'stands on all 17s'], ['Blackjack pays', r.blackjackPays === 1.5 ? '3 to 2' : r.blackjackPays + ' to 1'], ['Double', (r.doubleAnyTwo ? 'any two cards' : '9, 10, 11 only') + (r.doubleAfterSplit ? ', also after a split' : '')], ['Split', 'up to ' + r.maxSplitHands + ' hands; split aces get one card' + (r.resplitAces ? '' : ', no resplit of aces')], ['Surrender', r.lateSurrender ? 'late surrender after the dealer checks for blackjack' : 'not offered'], ['Insurance', r.insurance ? 'offered against an ace, pays 2 to 1' : 'not offered'], ['Table limits', r.minBet + ' to ' + r.maxBet]];
    this.el.helpBody.innerHTML = '<table class="pays">' + rows.map(x => '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>').join('') + '</table>' +
      '<p class="hint">Click a chip (or press 1–4) to add it to the selected seat, DEAL to start. During your turn: HIT (H), STAND (S), DOUBLE (X), SPLIT (P), SURRENDER (R); insurance Y/N. HINT (T) highlights the basic-strategy play, COUNT (K) shows the Hi-Lo running and true count. Dana, Ken and Victor play basic strategy with their own bankrolls.</p>' +
      '<p class="hint">House edge with these rules and perfect basic strategy: about 0.40% (20,000,000 simulated rounds, <code>node tools/sim.js</code>). Play money only; unofficial recreation.</p>';
  };
  BJ.UI = UI;
})(window);
