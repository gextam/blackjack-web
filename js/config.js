/* ============================================================================
   BLACKJACK — table rules, chips, seats, timings.
   Shared by the browser (window.BJ) and node tools (module.exports).
   ========================================================================== */
(function (root) {
  'use strict';
  const BJ = root.BJ || (root.BJ = {});

  BJ.RULES = {
    decks: 6,                 /* 1–8 */
    penetrationDecks: 1.5,    /* cut card: reshuffle when fewer cards than this remain */
    hitSoft17: false,         /* Vegas Strip: dealer stands on soft 17 */
    blackjackPays: 1.5,       /* 3 to 2 */
    doubleAnyTwo: true,
    doubleAfterSplit: true,
    maxSplitHands: 3,         /* split up to three hands */
    resplitAces: false,
    splitAcesOneCard: true,
    lateSurrender: true,
    insurance: true,
    peek: true,               /* dealer checks for blackjack under an ace or ten */
    minBet: 5, maxBet: 500
  };
  BJ.CHIPS = [
    { value: 5, color: '#d8262c', text: '#fff' }, { value: 25, color: '#1f8a3a', text: '#fff' },
    { value: 100, color: '#1b1b1f', text: '#fff' }, { value: 500, color: '#7a2ea3', text: '#fff' }
  ];
  /* seats left to right as seen by the dealer's camera; human sits centre */
  BJ.SEATS = [
    { id: 'dana', name: 'Dana', human: false, bankroll: 2200, color: '#2f8ae6', style: 'steady' },
    { id: 'ken', name: 'Ken', human: false, bankroll: 1500, color: '#f07d1a', style: 'swingy' },
    { id: 'you', name: 'You', human: true, bankroll: 1000, color: '#e9c250' },
    { id: 'you2', name: 'You · 2nd hand', human: true, optional: true, bankroll: 0, color: '#e9c250' },
    { id: 'victor', name: 'Victor', human: false, bankroll: 3800, color: '#b44ad6', style: 'big' }
  ];
  BJ.TIMING = { deal: 0.28, botThink: 0.9, dealerDraw: 0.9, settleHold: 4.5, betWindow: 25 };
  BJ.TITLE = 'BLACKJACK';
  BJ.RULE_TEXT = [
    'BLACKJACK PAYS 3 TO 2', 'Dealer must draw to 16 and stand on all 17s', 'INSURANCE PAYS 2 TO 1',
    'Six decks · double on any two cards · double after split · split up to three hands · split aces receive one card · late surrender'
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = BJ;
})(typeof window !== 'undefined' ? window : globalThis);
