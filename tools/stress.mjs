#!/usr/bin/env node
/* Stress test: plays many random rounds headless with two human seats on basic
   strategy (insurance taken every other time it is offered) and checks, every
   round, that each seat's chips are conserved: bankroll after the settlement
   equals bankroll + bets before the deal plus the sum of the hand results.
   Reports any round that stalls, with a state dump.
   usage: node tools/stress.mjs [rounds=120] */
import { launch } from './headless.mjs';
const rounds = parseInt(process.argv[2] || '120', 10);
const { page, errors, close } = await launch({ query: 'mute=1&fast=1' });
let ok = false;
try {
  const r = await page.eval(`(() => {
    BJ.ui.start(); BJ.step(1.0); const g = BJ.game; g.toggleSecondSeat();
    const stalls = [], mismatches = []; let settled = 0, bj = 0, splits = 0, doubles = 0, surrenders = 0, insured = 0, insOffers = 0, credits = 0;
    const startBank = g.seats[2].bankroll + g.seats[3].bankroll, startNet = g.stats.net;
    for (let k = 0; k < ${rounds}; k++) {
      let n = 0; while (g.state !== 'betting' && n++ < 300) BJ.step(0.1);
      if (g.state !== 'betting') { stalls.push({ k, where: 'waiting for betting', state: g.state }); break; }
      if (g.seats[2].bankroll < 60) { g.addCredits(500); credits += 500; }
      if (g.seats[3].active && g.seats[3].bankroll < 60) { g.seats[3].bankroll += 500; credits += 500; }
      const bet = [5, 25, 25, 50, 100][k % 5];
      g.addBet(bet, 2); if (g.seats[3].active) g.addBet(bet, 3);
      g.seats.forEach(s => g.placeBotBet(s));
      const pre = g.seats.map(s => s.bankroll + s.bet);
      if (!g.deal()) { stalls.push({ k, where: 'deal refused', bets: g.seats.map(s => s.bet) }); break; }
      n = 0;
      while (g.state !== 'settle' && n++ < 1500) {
        if (g.state === 'insurance') { insOffers++; const take = insOffers % 2 === 0; if (take) insured++; g.insuranceDecision(take); }
        if (g.state === 'playing' && g.turn && g.seats[g.turn.seat].human && !g.pendingAct) { const h = g.hintFor(g.turn.seat, g.turn.hand); g.act(h === 'D' ? 'double' : h === 'P' ? 'split' : h === 'R' ? 'surrender' : h === 'S' ? 'stand' : 'hit'); }
        BJ.step(0.1);
      }
      if (g.state !== 'settle') { stalls.push({ k, where: 'round', state: g.state, turn: g.turn, pending: g.pendingAct, queue: g.queue.length, seats: g.seats.map(s => ({ id: s.id, inRound: s.inRound, hands: s.hands && s.hands.map(h => ({ cards: h.cards.map(c => c.rank), done: g.handDone(h), stood: h.stood, dbl: h.doubled, sur: h.surrendered })) })), dealer: g.dealer.cards.map(c => c.rank) }); break; }
      settled++;
      g.seats.forEach((s, i) => {
        if (!s.inRound) { if (Math.abs(s.bankroll - pre[i]) > 1e-9) mismatches.push({ k, seat: s.id, pre: pre[i], post: s.bankroll, note: 'not in round' }); return; }
        const res = s.hands.reduce((a, h) => a + h.result, 0);
        if (Math.abs(s.bankroll - (pre[i] + res)) > 1e-9) mismatches.push({ k, seat: s.id, pre: pre[i], post: s.bankroll, results: s.hands.map(h => h.result), ins: s.hands.map(h => [h.insurance, h.insuranceLost]) });
        s.hands.forEach(h => { if (h.fromSplit) splits++; if (h.doubled) doubles++; if (h.surrendered) surrenders++; if (BJ.cards.handTotal(h.cards).natural && !h.fromSplit) bj++; });
      });
    }
    const endBank = g.seats[2].bankroll + g.seats[3].bankroll;
    const netOk = Math.abs((endBank - startBank - credits) - (g.stats.net - startNet)) < 1e-9;
    return { settled, bj, splits, doubles, surrenders, insOffers, insured, stalls, mismatches, netOk, bankDelta: endBank - startBank - credits, statsNet: g.stats.net - startNet, stats: g.stats, shoePos: g.shoePos, discards: g.discards };
  })()`);
  console.log(JSON.stringify(r, null, 1));
  ok = r.settled === rounds && r.stalls.length === 0 && r.mismatches.length === 0 && r.netOk;
} finally { await close(); }
if (errors.length) { console.log('PAGE ERRORS:'); errors.forEach(e => console.log(' -', e)); }
console.log(ok && !errors.length ? 'STRESS OK' : 'STRESS FAILED');
process.exitCode = ok && !errors.length ? 0 : 2;
