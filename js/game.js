/* ============================================================================
   BLACKJACK — round engine: betting, dealing from the shoe with animation
   timing, insurance and peek, player turns (human + basic-strategy regulars),
   dealer draw, settlement, discards, reshuffle, Hi-Lo count, dealer voice.
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ, K = BJ.cards, L = BJ.LAYOUT;
  const A = () => BJ.audio;
  function rng() { const c = root.crypto; if (c && c.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; } return Math.random(); }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const LINES = { welcome: 'Welcome to the table. Place your bets, please.', placebets: 'Place your bets, please.', goodluck: 'Good luck, everyone.', insurance: 'Insurance?', dealerbj: 'Dealer has blackjack.', dealerbust: 'Dealer busts. Winners, well done.', blackjack: 'Blackjack!', push: 'Push.', toomany: 'Too many.', d17: 'Dealer has seventeen.', d18: 'Dealer has eighteen.', d19: 'Dealer has nineteen.', d20: 'Dealer has twenty.', d21: 'Dealer has twenty-one.', shuffle: 'Shuffling.', nicehand: 'Nice hand.', badluck: 'Better luck next time.', nomore: 'No more bets.', stands: 'Dealer stands.' };

  function Game() {
    this.rules = Object.assign({}, BJ.RULES); this.timing = Object.assign({}, BJ.TIMING);
    this.seats = BJ.SEATS.map(s => Object.assign({ active: !s.optional, bet: 0, lastBet: 0, hands: null, inRound: false, shown: s.bankroll, textColor: '#fff' }, s));
    this.dealer = { cards: [], revealed: false };
    this.shoe = K.makeShoe(this.rules.decks, rng); this.shoePos = 0; this.discards = 0; this.runningCount = 0;
    this.views = []; this.queue = []; this.chainEnd = 0;
    this.state = 'boot'; this.now = 0; this.selectedSeat = 2; this.chip = 25; this.turn = null;
    this.message = ''; this.hint = false; this.showCount = false; this.round = 0;
    this.stats = { rounds: 0, wagered: 0, net: 0, blackjacks: 0 };
    this.forced = null; this.renderer = null; this.ui = null;
    this.voiceQueue = []; this.speaking = false; this.lastSaid = {};
  }
  const P = Game.prototype;

  /* ---------------------------------------------------------- helpers */
  P.seq = function (delay, fn) { this.chainEnd = Math.max(this.chainEnd, this.now) + delay; this.queue.push({ at: this.chainEnd, fn: fn }); return this.chainEnd; };
  P.at = function (delay, fn) { this.queue.push({ at: this.now + delay, fn: fn }); };
  P.setMessage = function (m) { this.message = m; };
  P.human = function () { return this.seats[2]; };
  P.decksLeft = function () { return (this.shoe.length - this.shoePos) / 52; };
  P.trueCount = function () { return this.runningCount / Math.max(0.5, this.decksLeft()); };
  P.count = function (card) { this.runningCount += K.HILO[card.rank]; };
  P.say = function (key, opts) {
    opts = opts || {}; if (!LINES[key]) return;
    if (opts.dedupe && this.lastSaid[key] && performance.now() - this.lastSaid[key] < opts.dedupe * 1000) return;
    this.lastSaid[key] = performance.now();
    if (opts.priority) this.voiceQueue.unshift(key); else this.voiceQueue.push(key);
    if (this.voiceQueue.length > 3) this.voiceQueue.length = 3;
    this._nextLine();
  };
  P._nextLine = function () {
    if (this.speaking || !this.voiceQueue.length) return;
    const key = this.voiceQueue.shift(); this.speaking = true;
    if (this.ui) this.ui.caption(LINES[key]);
    const done = () => { this.speaking = false; setTimeout(() => { if (!this.speaking && this.ui) this.ui.caption(''); }, 900); setTimeout(() => this._nextLine(), 200); };
    const a = A();
    if (a.hasClip(key) && a.ready && !a.muted) a.playClip(key).then(done); else setTimeout(done, Math.max(900, LINES[key].length * 55));
  };

  /* ----------------------------------------------------------- betting */
  P.begin = function () { A().startAmbience(); this.say('welcome'); this.startBetting(true); };
  P.startBetting = function (first) {
    this.state = 'betting'; this.round++; this.turn = null; this.views = []; this.dealer = { cards: [], revealed: false };
    this.seats.forEach(s => { s.hands = null; s.inRound = false; s.bet = 0; });
    if (this.shoe.length - this.shoePos < this.rules.penetrationDecks * 52) this.reshuffle();
    if (!first) this.say('placebets', { dedupe: 6 });
    this.setMessage('PLACE YOUR BETS  ·  then press DEAL');
    this.chainEnd = this.now;
    this.seats.forEach((s, i) => { if (!s.human && s.active) { if (s.bankroll < 100) { s.bankroll += 1000; this.setMessage(s.name.toUpperCase() + ' BUYS IN FOR 1,000'); } this.at(0.25 + i * 0.25 + Math.random() * 0.3, () => this.placeBotBet(s)); } });
    if (this.autoRebet) this.seq(0.2, () => this.rebet());
  };
  P.placeBotBet = function (s) { if (this.state !== 'betting' || s.bet > 0 || !s.active || s.human) return; s.bet = this.botBet(s); s.bankroll -= s.bet; A().chipPlace(); };
  P.reshuffle = function () { this.shoe = K.makeShoe(this.rules.decks, rng); this.shoePos = 0; this.discards = 0; this.runningCount = 0; this.say('shuffle', { priority: true }); A().shuffle(); this.setMessage('SHUFFLING THE SHOE'); };
  P.botBet = function (s) {
    const b = s.style === 'steady' ? pick([25, 25, 50, 50]) : s.style === 'swingy' ? pick([5, 25, 50, 100, 100]) : pick([100, 100, 200, 300]);
    return Math.min(b, s.bankroll, this.rules.maxBet);
  };
  P.selectSeat = function (i) { const s = this.seats[i]; if (!s || !s.human || !s.active) return false; this.selectedSeat = i; return true; };
  P.addBet = function (amount, seatIdx) {
    if (this.state !== 'betting') { A().deny(); return false; }
    const s = this.seats[seatIdx == null ? this.selectedSeat : seatIdx]; if (!s || !s.human || !s.active) { A().deny(); return false; }
    if (s.bankroll < amount) { A().deny(); this.setMessage('INSUFFICIENT BANKROLL'); return false; }
    if (s.bet + amount > this.rules.maxBet) { A().deny(); this.setMessage('TABLE MAXIMUM IS ' + this.rules.maxBet); return false; }
    s.bet += amount; s.bankroll -= amount; A().chipPlace(); this.setMessage(s.human ? (s.optional ? 'SECOND HAND BET ' : 'YOUR BET ') + s.bet : s.name.toUpperCase() + ' BETS ' + s.bet);
    return true;
  };
  P.clearBet = function () { if (this.state !== 'betting') { A().deny(); return; } let any = false; this.seats.forEach(s => { if (s.human && s.bet) { s.bankroll += s.bet; s.bet = 0; any = true; } }); if (any) A().chipTake(); else A().deny(); };
  P.rebet = function () { if (this.state !== 'betting') { A().deny(); return; } let any = false; this.seats.forEach(s => { if (s.human && s.active && s.lastBet && s.bet === 0 && s.bankroll >= s.lastBet) { s.bet = s.lastBet; s.bankroll -= s.bet; any = true; } }); if (any) A().chipPlace(); else A().deny(); };
  P.toggleSecondSeat = function () {
    const s = this.seats[3]; if (this.state !== 'betting') { A().deny(); return; }
    if (s.active) { this.human().bankroll += s.bet + s.bankroll; s.bankroll = 0; s.bet = 0; s.active = false; if (this.selectedSeat === 3) this.selectedSeat = 2; }
    else { const h = this.human(); const move = Math.min(h.bankroll, Math.max(0, Math.floor(h.bankroll / 2))); s.active = true; s.bankroll = move; h.bankroll -= move; this.selectedSeat = 3; }
    A().uiTick();
  };
  P.addCredits = function (n) { if (this.state !== 'betting') { A().deny(); return; } this.human().bankroll += n; A().chipPlace(); this.setMessage('BOUGHT IN FOR ' + n); };

  /* ----------------------------------------------------------- dealing */
  P.draw = function () {
    if (this.forced && this.forced.length) { const rank = this.forced.shift(); for (let i = this.shoePos; i < this.shoe.length; i++) if (this.shoe[i].rank === rank) { const c = this.shoe[i]; this.shoe[i] = this.shoe[this.shoePos]; this.shoe[this.shoePos] = c; break; } }
    return this.shoe[this.shoePos++];
  };
  P.deal = function () {
    if (this.state !== 'betting') { A().deny(); return false; }
    const humanIn = this.seats.some(s => s.human && s.active && s.bet >= this.rules.minBet);
    if (!humanIn) { A().deny(); this.setMessage('PLACE A BET OF AT LEAST ' + this.rules.minBet); return false; }
    this.seats.forEach(s => this.placeBotBet(s));
    this.state = 'dealing'; this.turn = null; this.stats.rounds++;
    this.seats.forEach(s => { s.inRound = s.active && s.bet >= this.rules.minBet; if (s.inRound) { s.hands = [this.newHand(s.bet)]; s.lastBet = s.bet; if (s.human) this.stats.wagered += s.bet; } else s.hands = null; });
    this.say('nomore', { dedupe: 30 });
    this.chainEnd = this.now;
    const order = this.seats.map((s, i) => i).filter(i => this.seats[i].inRound);
    order.forEach(i => this.seq(this.timing.deal, () => this.dealTo(i, 0, true)));
    this.seq(this.timing.deal, () => this.dealDealer(true));
    order.forEach(i => this.seq(this.timing.deal, () => this.dealTo(i, 0, true)));
    this.seq(this.timing.deal, () => this.dealDealer(false));
    this.seq(0.45, () => this.afterDeal());
    return true;
  };
  P.newHand = function (bet) { return { cards: [], bet: bet, fromSplit: false, splitAces: false, doubled: false, surrendered: false, stood: false, insurance: 0, insuranceLost: 0, result: null }; };
  P.dealTo = function (seatIdx, handIdx, faceUp) {
    const s = this.seats[seatIdx], h = s.hands[handIdx], card = this.draw(); h.cards.push(card); if (faceUp) this.count(card);
    const v = { card: card, seat: seatIdx, hand: handIdx, w: L.SEAT_CARD.w, h: L.SEAT_CARD.h, faceUp: faceUp };
    this.views.push(v); this.relayout(seatIdx, v); A().shoePull(); this.at(0.3, () => A().cardSnap());
    return card;
  };
  P.dealDealer = function (faceUp) {
    const card = this.draw(); this.dealer.cards.push(card); if (faceUp) this.count(card);
    const idx = this.dealer.cards.length - 1, p = this.dealerCardPos(idx);
    this.views.push({ card: card, dealer: true, index: idx, x: p.x, y: p.y, w: L.CARD.w, h: L.CARD.h, faceUp: faceUp, anim: { x0: L.SHOE.x - 56, y0: L.SHOE.y - 40, x1: p.x, y1: p.y, t0: this.now, dur: 0.32 } });
    A().shoePull(); this.at(0.32, () => A().cardSnap());
    return card;
  };
  P.dealerCardPos = function (idx) { return { x: L.DEALER.x - 112 + idx * 52, y: L.DEALER.y - 80 }; };
  P.relayout = function (seatIdx, fresh) {
    const s = this.seats[seatIdx]; if (!s.hands) return; const n = s.hands.length;
    s.hands.forEach((h, hi) => { const a = this.renderer.handAnchor(seatIdx, hi, n); h.cards.forEach((c, ci) => { const v = this.views.find(x => x.card === c); if (!v) return; const p = this.renderer.cardPos(a, ci, L.SEAT_CARD); if (v === fresh) { v.x = p.x; v.y = p.y; v.anim = { x0: L.SHOE.x - 56, y0: L.SHOE.y - 40, x1: p.x, y1: p.y, t0: this.now, dur: 0.3 }; } else if (Math.abs(v.x - p.x) > 1 || Math.abs(v.y - p.y) > 1) { v.anim = { x0: v.x, y0: v.y, x1: p.x, y1: p.y, t0: this.now, dur: 0.3 }; v.x = p.x; v.y = p.y; } v.hand = hi; }); });
  };

  P.afterDeal = function () {
    const up = this.dealer.cards[0];
    if (this.seats.some(s => s.inRound && K.handTotal(s.hands[0].cards).natural)) { this.say('blackjack'); this.stats.blackjacks += this.human().inRound && K.handTotal(this.human().hands[0].cards).natural ? 1 : 0; }
    if (up.rank === 'A' && this.rules.insurance) { this.offerInsurance(); return; }
    if (K.VALUE[up.rank] === 10 && this.rules.peek && K.handTotal(this.dealer.cards).natural) { this.revealDealer(); this.seq(0.7, () => { this.say('dealerbj', { priority: true }); this.settleAll(); }); return; }
    this.say('goodluck', { dedupe: 20 }); this.startPlay();
  };
  P.offerInsurance = function () {
    this.state = 'insurance'; this.say('insurance', { priority: true }); this.setMessage('INSURANCE PAYS 2 TO 1  ·  take insurance?');
    this.seats.forEach(s => { if (s.inRound && !s.human && this.trueCount() >= 3 && s.bankroll >= s.bet / 2) { s.hands[0].insurance = s.bet / 2; s.bankroll -= s.bet / 2; } });
    if (!this.seats.some(s => s.inRound && s.human)) this.insuranceDecision(false);
  };
  P.insuranceDecision = function (take) {
    if (this.state !== 'insurance') return;
    if (take) this.seats.forEach(s => { if (s.inRound && s.human) { const ins = s.bet / 2; if (s.bankroll >= ins) { s.hands[0].insurance = ins; s.bankroll -= ins; A().chipPlace(); } } });
    this.state = 'peek'; this.chainEnd = this.now;
    this.seq(0.6, () => {
      if (K.handTotal(this.dealer.cards).natural) { this.revealDealer(); this.seq(0.7, () => { this.say('dealerbj', { priority: true }); this.settleAll(); }); }
      else {
        /* no blackjack: the insurance bets are lost and swept to the dealer; the loss is kept for the hand's result */
        const R = this.renderer;
        this.seats.forEach((s, i) => s.hands && s.hands.forEach((h, hi) => { if (h.insurance) { h.insuranceLost = (h.insuranceLost || 0) + h.insurance; h.insurance = 0; const a = R.handAnchor(i, hi, s.hands.length); R.fly({ x: a.x + 88, y: a.y + 160 }, { x: L.DEALER.x, y: L.DEALER.y + 60 }, s.human ? '#e9c250' : s.color, 0.6, 1); } }));
        A().chipTake(); this.setMessage('NO BLACKJACK'); this.say('goodluck', { dedupe: 20 }); this.startPlay();
      }
    });
  };

  /* ------------------------------------------------------------- turns */
  P.startPlay = function () { this.state = 'playing'; this.nextTurn(); };
  P.handDone = function (h) {
    if (h.surrendered || h.stood || h.doubled && h.cards.length >= 3) return true;
    const t = K.handTotal(h.cards); if (t.bust || t.total === 21) return true;
    if (h.splitAces && h.cards.length >= 2) return true;
    return false;
  };
  P.nextTurn = function () {
    if (this.state !== 'playing') return;
    this.pendingAct = false;
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i]; if (!s.inRound) continue;
      for (let j = 0; j < s.hands.length; j++) {
        const h = s.hands[j];
        /* a split hand waiting for its second card: input stays locked until it arrives */
        if (h.cards.length === 1) { this.turn = { seat: i, hand: j }; this.pendingAct = true; this.dealTo(i, j, true); this.seq(0.4, () => this.nextTurn()); return; }
        if (this.handDone(h)) continue;
        this.turn = { seat: i, hand: j };
        if (s.human) { this.setMessage(s.optional ? 'YOUR SECOND HAND TO ACT' : 'YOU TO ACT'); return; }
        this.seq(this.timing.botThink, () => this.botAct(i, j)); return;
      }
    }
    this.turn = null; this.dealerPhase();
  };
  P.options = function (seatIdx, handIdx) {
    const s = this.seats[seatIdx], h = s.hands[handIdx];
    return { hit: true, stand: true, double: K.canDouble(h, this.rules) && s.bankroll >= h.bet, split: K.canSplit(h, s.hands.length, this.rules) && s.bankroll >= h.bet, surrender: K.canSurrender(h, this.rules) };
  };
  P.hintFor = function (seatIdx, handIdx) { const s = this.seats[seatIdx], h = s.hands[handIdx], o = this.options(seatIdx, handIdx); return K.basic(h.cards, this.dealer.cards[0].rank, { rules: this.rules, canDouble: o.double, canSplit: o.split, canSurrender: o.surrender }); };
  P.botAct = function (i, j) { if (this.state !== 'playing' || this.pendingAct || !this.turn || this.turn.seat !== i || this.turn.hand !== j) return; this.apply(i, j, this.hintFor(i, j)); };
  P.act = function (action) {
    if (this.state !== 'playing' || !this.turn) { A().deny(); return false; }
    if (this.pendingAct) return false;
    const s = this.seats[this.turn.seat]; if (!s.human) { A().deny(); return false; }
    const map = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' }, o = this.options(this.turn.seat, this.turn.hand);
    if (!o[action]) { A().deny(); return false; }
    this.apply(this.turn.seat, this.turn.hand, map[action]); return true;
  };
  P.apply = function (i, j, code) {
    const s = this.seats[i], h = s.hands[j];
    this.pendingAct = true;
    if (code === 'R') { h.surrendered = true; this.setMessage(s.human ? 'YOU SURRENDER' : s.name.toUpperCase() + ' SURRENDERS'); A().chipTake(); this.seq(0.5, () => this.nextTurn()); return; }
    if (code === 'P') {
      const second = h.cards.pop(), aces = h.cards[0].rank === 'A' && this.rules.splitAcesOneCard;
      h.fromSplit = true; h.splitAces = aces; const nh = this.newHand(h.bet); nh.fromSplit = true; nh.splitAces = aces; nh.cards.push(second);
      s.hands.splice(j + 1, 0, nh); s.bankroll -= h.bet; A().chipPlace(); this.relayout(i);
      this.seq(0.35, () => { this.dealTo(i, j, true); this.seq(0.4, () => this.nextTurn()); }); return;
    }
    if (code === 'D') { h.doubled = true; s.bankroll -= h.bet; h.bet *= 2; A().chipPlace(); this.seq(0.3, () => { this.dealTo(i, j, true); this.seq(0.45, () => { this.afterCard(i, j); this.nextTurn(); }); }); return; }
    if (code === 'H') { this.dealTo(i, j, true); this.seq(0.45, () => { this.afterCard(i, j); this.nextTurn(); }); return; }
    h.stood = true; this.seq(0.25, () => this.nextTurn());
  };
  P.afterCard = function (i, j) { const s = this.seats[i], t = K.handTotal(s.hands[j].cards); if (t.bust) { A().bustThud(); if (s.human) this.say('toomany', { dedupe: 3 }); } };

  /* ------------------------------------------------------------ dealer */
  P.revealDealer = function () {
    if (this.dealer.revealed) return; this.dealer.revealed = true;
    const v = this.views.find(x => x.dealer && x.index === 1); if (v) v.flip = { t0: this.now, dur: 0.45, to: true };
    this.count(this.dealer.cards[1]); A().cardFlip();
  };
  P.dealerPhase = function () {
    if (this.state !== 'playing') return;
    this.state = 'dealer'; this.revealDealer();
    /* the dealer only draws while a hand is still in contention (not bust, surrendered or a paid natural) */
    const live = this.seats.some(s => s.inRound && s.hands.some(h => { const t = K.handTotal(h.cards); return !h.surrendered && !t.bust && !(t.natural && !h.fromSplit); }));
    if (!live) { this.seq(0.9, () => this.settleAll()); return; }
    this.seq(this.timing.dealerDraw, () => this.dealerStep());
  };
  P.dealerStep = function () {
    if (K.dealerShouldHit(this.dealer.cards, this.rules)) { this.dealDealer(true); this.seq(this.timing.dealerDraw, () => this.dealerStep()); return; }
    const t = K.handTotal(this.dealer.cards);
    if (t.bust) { this.say('dealerbust', { priority: true }); A().bustThud(); } else this.say('d' + t.total, { priority: true });
    this.seq(0.9, () => this.settleAll());
  };
  P.settleAll = function () {
    if (this.state === 'settle' || this.state === 'betting') return;
    this.state = 'settle'; const dNat = K.handTotal(this.dealer.cards).natural, R = this.renderer;
    let humanNet = 0, humanWin = false, humanPush = false, humanAny = false;
    this.seats.forEach((s, i) => {
      if (!s.inRound) return;
      s.hands.forEach((h, hi) => {
        const m = K.settle(h, this.dealer.cards, dNat, this.rules);
        const back = m > 0 ? h.bet * (1 + m) : m === 0 ? h.bet : m === -0.5 ? h.bet * 0.5 : 0;
        s.bankroll += back; h.result = h.bet * m;
        if (h.insurance) { if (dNat) { s.bankroll += h.insurance * 3; h.result += h.insurance * 2; } else h.result -= h.insurance; }
        if (h.insuranceLost) h.result -= h.insuranceLost;
        const a = R.handAnchor(i, hi, s.hands.length), spot = { x: a.x + 40, y: a.y + 150 }, color = s.human ? '#e9c250' : s.color;
        if (m > 0) { R.fly({ x: L.DEALER.x, y: L.DEALER.y + 60 }, spot, color, 0.7, Math.min(6, 1 + Math.floor(h.bet * m / 50))); R.label(spot.x, spot.y - 60, '+' + BJ.fmt(h.bet * m), '#7cff9d'); }
        else if (m < 0) R.fly(spot, { x: L.DEALER.x, y: L.DEALER.y + 60 }, color, 0.6, Math.min(4, 1 + Math.floor(h.bet / 100)));
        if (s.human) { humanAny = true; humanNet += h.result; if (m > 0) humanWin = true; if (m === 0) humanPush = true; }
      });
    });
    this.stats.net += humanNet;
    this.at(0.4, () => A().chipPay(Math.min(10, 3 + Math.abs(humanNet) / 50)));
    if (humanAny) {
      if (humanWin && humanNet > 0) { A().winChime(humanNet >= 150); if (humanNet >= 150) this.say('nicehand', { dedupe: 10 }); this.setMessage('YOU WIN +' + BJ.fmt(humanNet)); }
      else if (humanNet === 0 && humanPush) { A().pushTone(); this.say('push', { dedupe: 4 }); this.setMessage('PUSH'); }
      else if (humanNet < 0) { this.say('badluck', { dedupe: 25 }); this.setMessage('YOU LOSE ' + BJ.fmt(-humanNet)); }
      else this.setMessage('ROUND OVER');
    }
    const r = this.round; this.seq(this.timing.settleHold, () => { if (this.round === r && this.state === 'settle') this.clearTable(); });
  };
  P.clearTable = function () {
    this.views.forEach((v, i) => { v.anim = { x0: v.x, y0: v.y, x1: L.TRAY.x - 52, y1: L.TRAY.y - 70, t0: this.now + i * 0.03, dur: 0.4 }; v.x = L.TRAY.x - 52; v.y = L.TRAY.y - 70; if (!v.faceUp) v.flip = { t0: this.now + i * 0.03, dur: 0.3, to: true }; });
    this.discards += this.views.length; A().cardSlide(); this.at(0.5, () => A().chipTake());
    const r = this.round; this.seq(0.75, () => { if (this.round === r) this.startBetting(false); });
  };

  P.update = function (now) {
    this.now = now;
    this.seats.forEach(s => { if (s.shown == null) s.shown = s.bankroll; s.shown += (s.bankroll - s.shown) * 0.12; if (Math.abs(s.bankroll - s.shown) < 0.5) s.shown = s.bankroll; });
    if (this.queue.length) { this.queue.sort((a, b) => a.at - b.at); while (this.queue.length && this.queue[0].at <= now) { const q = this.queue.shift(); q.fn(); } }
  };

  BJ.Game = Game; BJ.LINES = LINES;
})(window);
