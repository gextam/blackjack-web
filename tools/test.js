/* Unit tests for hand evaluation, rules and strategy. usage: node tools/test.js */
'use strict';
const BJ = require('../js/config.js'); require('../js/cards.js');
const K = BJ.cards, R = BJ.RULES;
let pass = 0, fail = 0;
const c = (rank, suit) => ({ rank: rank, suit: suit || 'S' });
function eq(name, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); if (ok) pass++; else { fail++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); } }

/* totals */
eq('hard 10+7', K.handTotal([c('10'), c('7')]).total, 17);
eq('soft A+6', K.handTotal([c('A'), c('6')]), { total: 17, soft: true, bust: false, natural: false });
eq('A+6+10 becomes hard 17', K.handTotal([c('A'), c('6'), c('10')]), { total: 17, soft: false, bust: false, natural: false });
eq('A+A soft 12', K.handTotal([c('A'), c('A')]), { total: 12, soft: true, bust: false, natural: false });
eq('natural A+K', K.handTotal([c('A'), c('K')]).natural, true);
eq('three-card 21 not natural', K.handTotal([c('7'), c('7'), c('7')]).natural, false);
eq('bust 10+9+5', K.handTotal([c('10'), c('9'), c('5')]).bust, true);
/* dealer */
eq('dealer hits 16', K.dealerShouldHit([c('10'), c('6')], R), true);
eq('dealer stands soft 17 (S17)', K.dealerShouldHit([c('A'), c('6')], R), false);
eq('dealer hits soft 17 (H17)', K.dealerShouldHit([c('A'), c('6')], Object.assign({}, R, { hitSoft17: true })), true);
eq('dealer stands hard 17', K.dealerShouldHit([c('10'), c('7')], R), false);
/* settlement */
const H = (cards, o) => Object.assign({ cards: cards, bet: 10, fromSplit: false, doubled: false, surrendered: false }, o || {});
eq('natural pays 3:2', K.settle(H([c('A'), c('K')]), [c('10'), c('9')], false, R), 1.5);
eq('natural vs dealer natural pushes', K.settle(H([c('A'), c('K')]), [c('A'), c('Q')], true, R), 0);
eq('21 after split is not a natural', K.settle(H([c('A'), c('K')], { fromSplit: true }), [c('10'), c('9')], false, R), 1);
eq('split 21 loses to dealer natural', K.settle(H([c('A'), c('K')], { fromSplit: true }), [c('A'), c('Q')], true, R), -1);
eq('player bust loses even if dealer busts', K.settle(H([c('10'), c('9'), c('5')]), [c('10'), c('6'), c('9')], false, R), -1);
eq('dealer bust wins', K.settle(H([c('10'), c('2')]), [c('10'), c('6'), c('9')], false, R), 1);
eq('push on equal totals', K.settle(H([c('10'), c('8')]), [c('9'), c('9')], false, R), 0);
eq('surrender loses half', K.settle(H([c('10'), c('6')], { surrendered: true }), [c('10'), c('9')], false, R), -0.5);
/* options */
eq('can double any two', K.canDouble(H([c('2'), c('3')]), R), true);
eq('cannot double three cards', K.canDouble(H([c('2'), c('3'), c('4')]), R), false);
eq('cannot double split aces', K.canDouble(H([c('A'), c('5')], { fromSplit: true, splitAces: true }), R), false);
eq('can split pair below max', K.canSplit(H([c('8'), c('8')]), 1, R), true);
eq('cannot split at max hands', K.canSplit(H([c('8'), c('8')]), 3, R), false);
eq('no resplit of aces', K.canSplit(H([c('A'), c('A')], { fromSplit: true }), 2, R), false);
eq('ten-value pair splits (K,10)', K.canSplit(H([c('K'), c('10')]), 1, R), true);
eq('no surrender after split', K.canSurrender(H([c('10'), c('6')], { fromSplit: true }), R), false);
/* strategy */
const opt = (o) => Object.assign({ rules: R, canDouble: true, canSplit: true, canSurrender: true }, o || {});
eq('16 vs 10 surrenders', K.basic([c('10'), c('6')], '10', opt()), 'R');
eq('16 vs 10 hits without surrender', K.basic([c('10'), c('6')], '10', opt({ canSurrender: false })), 'H');
eq('8,8 vs 10 splits', K.basic([c('8'), c('8')], '10', opt()), 'P');
eq('A,A splits', K.basic([c('A'), c('A')], '6', opt()), 'P');
eq('10,10 stands', K.basic([c('10'), c('K')], '6', opt()), 'S');
eq('9,9 vs 7 stands', K.basic([c('9'), c('9')], '7', opt()), 'S');
eq('11 vs 10 doubles', K.basic([c('6'), c('5')], '10', opt()), 'D');
eq('11 vs A hits (S17)', K.basic([c('6'), c('5')], 'A', opt()), 'H');
eq('11 vs A doubles (H17)', K.basic([c('6'), c('5')], 'A', opt({ rules: Object.assign({}, R, { hitSoft17: true }) })), 'D');
eq('A,7 vs 3 doubles', K.basic([c('A'), c('7')], '3', opt()), 'D');
eq('A,7 vs 3 stands when no double', K.basic([c('A'), c('7')], '3', opt({ canDouble: false })), 'S');
eq('A,7 vs 9 hits', K.basic([c('A'), c('7')], '9', opt()), 'H');
eq('12 vs 2 hits', K.basic([c('10'), c('2')], '2', opt()), 'H');
eq('12 vs 4 stands', K.basic([c('10'), c('2')], '4', opt()), 'S');
eq('hard 9 vs 3 doubles', K.basic([c('5'), c('4')], '3', opt()), 'D');
eq('5,5 plays as 10: double vs 9', K.basic([c('5'), c('5')], '9', opt()), 'D');
eq('4,4 vs 5 splits with DAS', K.basic([c('4'), c('4')], '5', opt()), 'P');
eq('4,4 vs 5 hits without DAS', K.basic([c('4'), c('4')], '5', opt({ rules: Object.assign({}, R, { doubleAfterSplit: false }) })), 'H');
/* playSeat: split aces get exactly one card each */
const q = [c('9'), c('5'), c('K'), c('3')]; const draw = () => q.shift();
const hands = K.playSeat([c('A'), c('A')], '6', R, draw, K.basic, 10);
eq('split aces -> two hands', hands.length, 2);
eq('split aces -> one card each', hands.map(h => h.cards.length), [2, 2]);
eq('split aces -> no doubling flag', hands.map(h => h.doubled), [false, false]);
/* playSeat: double takes one card and stops */
const q2 = [c('9'), c('2')]; const hands2 = K.playSeat([c('6'), c('5')], '8', R, () => q2.shift(), K.basic, 10);
eq('double -> bet doubled, 3 cards', [hands2[0].bet, hands2[0].cards.length, hands2[0].doubled], [20, 3, true]);
console.log(pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
