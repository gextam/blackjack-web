/* ============================================================================
   BLACKJACK — cards, shoe, hand evaluation, Hi-Lo count, rule helpers and
   basic strategy (6 decks, S17/H17, DAS, late surrender). Pure functions,
   shared by the game, the simulator and the unit tests.
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ || (root.BJ = {});
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];
  const VALUE = { A: 11, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };
  const HILO = { A: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, J: -1, Q: -1, K: -1 };

  function makeShoe(decks, rng) {
    rng = rng || Math.random;
    const cards = [];
    for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ rank: r, suit: s, id: r + s + d });
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    return cards;
  }
  /* {total, soft, bust, natural} — natural = two-card 21 */
  function handTotal(cards) {
    let total = 0, aces = 0;
    for (const c of cards) { total += VALUE[c.rank]; if (c.rank === 'A') aces++; }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0, bust: total > 21, natural: cards.length === 2 && total === 21 };
  }
  const isTen = r => VALUE[r] === 10;
  function isPair(cards) { return cards.length === 2 && VALUE[cards[0].rank] === VALUE[cards[1].rank]; }

  /* hand: {cards, bet, fromSplit, splitAces, doubled, surrendered, done} */
  function canDouble(hand, rules) {
    if (hand.cards.length !== 2 || hand.doubled || hand.splitAces) return false;
    if (hand.fromSplit && !rules.doubleAfterSplit) return false;
    if (!rules.doubleAnyTwo) { const t = handTotal(hand.cards).total; if (t < 9 || t > 11) return false; }
    return true;
  }
  function canSplit(hand, handCount, rules) {
    if (!isPair(hand.cards) || handCount >= rules.maxSplitHands) return false;
    if (hand.cards[0].rank === 'A' && hand.fromSplit && !rules.resplitAces) return false;
    return true;
  }
  function canSurrender(hand, rules) { return rules.lateSurrender && hand.cards.length === 2 && !hand.fromSplit && !hand.doubled; }

  /* dealer: draws to 16, stands on 17 (hits soft 17 when rules.hitSoft17) */
  function dealerShouldHit(cards, rules) {
    const t = handTotal(cards);
    if (t.total < 17) return true;
    if (t.total === 17 && t.soft && rules.hitSoft17) return true;
    return false;
  }
  /* profit multiple of the hand's bet: +1.5 natural, +1 win, 0 push, -1 loss, -0.5 surrender */
  function settle(hand, dealerCards, dealerNatural, rules) {
    if (hand.surrendered) return -0.5;
    const p = handTotal(hand.cards);
    const natural = p.natural && !hand.fromSplit;
    if (dealerNatural) return natural ? 0 : -1;
    if (natural) return rules.blackjackPays;
    if (p.bust) return -1;
    const d = handTotal(dealerCards);
    if (d.bust) return 1;
    if (p.total > d.total) return 1;
    if (p.total < d.total) return -1;
    return 0;
  }

  /* basic strategy: 'H' hit, 'S' stand, 'D' double, 'P' split, 'R' surrender */
  function basic(cards, upRank, opt) {
    const up = VALUE[upRank], t = handTotal(cards), n = cards.length, rules = opt.rules;
    const h17 = rules.hitSoft17, das = rules.doubleAfterSplit;
    const pair = isPair(cards);
    if (opt.canSurrender && n === 2 && !t.soft) {
      if (t.total === 16 && !pair && (up === 9 || up === 10 || up === 11)) return 'R';
      if (t.total === 16 && pair && up === 11 && h17) return 'R';          /* 8,8 vs A in H17 */
      if (t.total === 15 && (up === 10 || (h17 && up === 11))) return 'R';
      if (h17 && t.total === 17 && up === 11) return 'R';
    }
    if (pair && opt.canSplit) {
      const r = VALUE[cards[0].rank];
      if (r === 11) return 'P';
      if (r === 9) return (up === 7 || up >= 10) ? 'S' : 'P';
      if (r === 8) return 'P';
      if (r === 7) return up <= 7 ? 'P' : 'H';
      if (r === 6) return (up >= (das ? 2 : 3) && up <= 6) ? 'P' : 'H';
      if (r === 4) return (das && (up === 5 || up === 6)) ? 'P' : 'H';
      if (r === 3 || r === 2) return (up >= (das ? 2 : 4) && up <= 7) ? 'P' : 'H';
      /* 10s stand, 5s play as hard 10 below */
      if (r === 10) return 'S';
    }
    const D = opt.canDouble;
    if (t.soft) {
      const s = t.total;
      if (s >= 20) return 'S';
      if (s === 19) return (h17 && up === 6 && D) ? 'D' : 'S';
      if (s === 18) { if (up <= 6) return D ? 'D' : 'S'; if (up <= 8) return 'S'; return 'H'; }
      if (s === 17) return (up >= 3 && up <= 6 && D) ? 'D' : 'H';
      if (s >= 15) return (up >= 4 && up <= 6 && D) ? 'D' : 'H';
      return (up >= 5 && up <= 6 && D) ? 'D' : 'H';
    }
    const h = t.total;
    if (h >= 17) return 'S';
    if (h >= 13) return up <= 6 ? 'S' : 'H';
    if (h === 12) return (up >= 4 && up <= 6) ? 'S' : 'H';
    if (h === 11) return (D && (up <= 10 || h17)) ? 'D' : 'H';
    if (h === 10) return (D && up <= 9) ? 'D' : 'H';
    if (h === 9) return (D && up >= 3 && up <= 6) ? 'D' : 'H';
    return 'H';
  }
  /* play one hand to completion against `up`; `draw()` returns a card; returns list of hands (splits) */
  function playSeat(initial, up, rules, draw, decide, bet) {
    const hands = [{ cards: initial.slice(), bet: bet, fromSplit: false, splitAces: false, doubled: false, surrendered: false }];
    let i = 0;
    while (i < hands.length) {
      const hand = hands[i];
      while (true) {
        const t = handTotal(hand.cards);
        if (t.bust || t.total === 21 || hand.splitAces && hand.cards.length >= 2) break;
        const act = decide(hand.cards, up, { rules: rules, canDouble: canDouble(hand, rules), canSplit: canSplit(hand, hands.length, rules), canSurrender: canSurrender(hand, rules), fromSplit: hand.fromSplit });
        if (act === 'R' && canSurrender(hand, rules)) { hand.surrendered = true; break; }
        if (act === 'P' && canSplit(hand, hands.length, rules)) {
          const second = hand.cards.pop(); const aces = hand.cards[0].rank === 'A';
          hand.fromSplit = true; hand.splitAces = aces && rules.splitAcesOneCard;
          hands.splice(i + 1, 0, { cards: [second], bet: hand.bet, fromSplit: true, splitAces: aces && rules.splitAcesOneCard, doubled: false, surrendered: false });
          hand.cards.push(draw());
          continue;
        }
        if (act === 'D' && canDouble(hand, rules)) { hand.doubled = true; hand.bet *= 2; hand.cards.push(draw()); break; }
        if (act === 'H' || act === 'D' || act === 'P' || act === 'R') { hand.cards.push(draw()); continue; }
        break; /* stand */
      }
      i++;
      /* second card for a freshly split hand that has only one */
      for (let k = 0; k < hands.length; k++) if (hands[k].cards.length === 1) hands[k].cards.push(draw());
    }
    return hands;
  }

  BJ.cards = { RANKS: RANKS, SUITS: SUITS, VALUE: VALUE, HILO: HILO, makeShoe: makeShoe, handTotal: handTotal, isPair: isPair, isTen: isTen, canDouble: canDouble, canSplit: canSplit, canSurrender: canSurrender, dealerShouldHit: dealerShouldHit, settle: settle, basic: basic, playSeat: playSeat };
  if (typeof module !== 'undefined' && module.exports) module.exports = BJ;
})(typeof window !== 'undefined' ? window : globalThis);
