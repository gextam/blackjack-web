/* House-edge simulation: basic strategy, one seat, the game's own rule code.
   usage: node tools/sim.js [rounds=1000000] [--h17] [--decks=6] [--no-surrender] [--no-das] */
'use strict';
const BJ = require('../js/config.js'); require('../js/cards.js');
const K = BJ.cards;
const args = process.argv.slice(2);
const rounds = parseInt(args.find(a => /^\d+$/.test(a)) || '1000000', 10);
const rules = Object.assign({}, BJ.RULES);
if (args.includes('--h17')) rules.hitSoft17 = true;
if (args.includes('--no-surrender')) rules.lateSurrender = false;
if (args.includes('--no-das')) rules.doubleAfterSplit = false;
const dk = args.find(a => a.startsWith('--decks=')); if (dk) rules.decks = parseInt(dk.split('=')[1], 10);

/* fast xorshift for the shoe */
let seed = 0x9E3779B9; function rng() { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

let shoe = K.makeShoe(rules.decks, rng), pos = 0;
const cut = rules.penetrationDecks * 52;
const draw = () => shoe[pos++];
let wagered = 0, profit = 0, naturals = 0, dealerNaturals = 0, busts = 0, doubles = 0, splits = 0, surrenders = 0, wins = 0, losses = 0, pushes = 0, hands = 0;
const t0 = Date.now();
for (let r = 0; r < rounds; r++) {
  if (shoe.length - pos < cut + 20) { shoe = K.makeShoe(rules.decks, rng); pos = 0; }
  const p = [draw()], d = [draw()]; p.push(draw()); d.push(draw());
  const up = d[0].rank;
  const dNat = K.handTotal(d).natural; if (dNat) dealerNaturals++;
  const pNat = K.handTotal(p).natural; if (pNat) naturals++;
  let seatHands;
  if (dNat || pNat) seatHands = [{ cards: p, bet: 1, fromSplit: false, doubled: false, surrendered: false }];
  else seatHands = K.playSeat(p, up, rules, draw, K.basic, 1);
  const anyLive = seatHands.some(h => !h.surrendered && !K.handTotal(h.cards).bust);
  if (!dNat && !pNat && anyLive) while (K.dealerShouldHit(d, rules)) d.push(draw());
  for (const h of seatHands) {
    const m = K.settle(h, d, dNat, rules);
    wagered += 1; profit += m * h.bet; hands++;
    if (h.doubled) doubles++; if (h.fromSplit) splits++; if (h.surrendered) surrenders++;
    if (K.handTotal(h.cards).bust) busts++;
    if (m > 0) wins++; else if (m < 0) losses++; else pushes++;
  }
}
const ms = Date.now() - t0;
console.log('rules: %d decks, %s, DAS %s, late surrender %s, split to %d hands, BJ pays %s', rules.decks, rules.hitSoft17 ? 'H17' : 'S17', rules.doubleAfterSplit, rules.lateSurrender, rules.maxSplitHands, rules.blackjackPays);
console.log('rounds %d (%d hands incl. splits) in %ss', rounds, hands, (ms / 1000).toFixed(1));
console.log('player return on initial bets: %s%%  (house edge %s%%)', (100 * profit / rounds).toFixed(3), (-100 * profit / rounds).toFixed(3));
console.log('player naturals %s%%, dealer naturals %s%%, hands: win %s%% lose %s%% push %s%%', (100 * naturals / rounds).toFixed(2), (100 * dealerNaturals / rounds).toFixed(2), (100 * wins / hands).toFixed(1), (100 * losses / hands).toFixed(1), (100 * pushes / hands).toFixed(1));
console.log('doubles %s%% of hands, split hands %s%%, surrenders %s%%, player busts %s%%', (100 * doubles / hands).toFixed(1), (100 * splits / hands).toFixed(1), (100 * surrenders / hands).toFixed(2), (100 * busts / hands).toFixed(1));
