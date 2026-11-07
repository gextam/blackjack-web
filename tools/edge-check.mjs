#!/usr/bin/env node
/* Headless edge check: the browser engine (not the simulator) plays flat-bet
   basic strategy on two human seats with the regulars sent away, and reports
   the player return, outcome frequencies and the rank distribution dealt.
   usage: node tools/edge-check.mjs [rounds=1500] */
import { launch } from './headless.mjs';
const rounds = parseInt(process.argv[2] || '1500', 10);
const { page, errors, close } = await launch({ query: 'mute=1&fast=1' });
try {
  const r = await page.eval(`(() => {
    BJ.ui.start(); BJ.step(1.0); const g = BJ.game; g.toggleSecondSeat();
    Object.assign(g.timing, { deal: 0.02, botThink: 0.02, dealerDraw: 0.02, settleHold: 0.05 });
    [0, 1, 4].forEach(i => { g.seats[i].active = false; });
    const ranks = {}; BJ.cards.RANKS.forEach(k => ranks[k] = 0);
    const out = { hands: 0, wagered: 0, net: 0, win: 0, lose: 0, push: 0, natural: 0, dealerNatural: 0, doubled: 0, split: 0, surrendered: 0, bust: 0, dealerBust: 0, insuranceOffers: 0, rounds: 0, stalls: 0 };
    const ups = {}; const dealerTotals = {};
    for (let k = 0; k < ${rounds}; k++) {
      let n = 0; while (g.state !== 'betting' && n++ < 400) BJ.step(0.05);
      if (g.state !== 'betting') { out.stalls++; break; }
      [2, 3].forEach(i => { if (g.seats[i].bankroll < 200) g.seats[i].bankroll += 1000; g.addBet(25, i); });
      const pre = g.seats[2].bankroll + g.seats[3].bankroll;
      if (!g.deal()) { out.stalls++; break; }
      n = 0;
      while (g.state !== 'settle' && n++ < 2000) {
        if (g.state === 'insurance') { out.insuranceOffers++; g.insuranceDecision(false); }
        if (g.state === 'playing' && g.turn && g.seats[g.turn.seat].human && !g.pendingAct) { const h = g.hintFor(g.turn.seat, g.turn.hand); g.act(h === 'D' ? 'double' : h === 'P' ? 'split' : h === 'R' ? 'surrender' : h === 'S' ? 'stand' : 'hit'); }
        BJ.step(0.05);
      }
      if (g.state !== 'settle') { out.stalls++; break; }
      out.rounds++;
      g.views.forEach(v => { ranks[v.card.rank]++; });
      const up = g.dealer.cards[0].rank; ups[up] = (ups[up] || 0) + 1;
      const dt = BJ.cards.handTotal(g.dealer.cards); const key = dt.bust ? 'bust' : String(dt.total); dealerTotals[key] = (dealerTotals[key] || 0) + 1;
      if (dt.natural) out.dealerNatural++;
      if (dt.bust) out.dealerBust++;
      [2, 3].forEach(i => g.seats[i].hands.forEach(h => {
        out.hands++; out.wagered += 25; out.net += h.result;
        if (h.result > 0) out.win++; else if (h.result < 0) out.lose++; else out.push++;
        const t = BJ.cards.handTotal(h.cards); if (t.natural && !h.fromSplit) out.natural++; if (t.bust) out.bust++;
        if (h.doubled) out.doubled++; if (h.fromSplit) out.split++; if (h.surrendered) out.surrendered++;
      }));
      out.net2 = (out.net2 || 0) + (g.seats[2].bankroll + g.seats[3].bankroll - pre);
    }
    const total = Object.values(ranks).reduce((a, b) => a + b, 0);
    const pct = {}; Object.keys(ranks).forEach(k => pct[k] = (100 * ranks[k] / total).toFixed(2) + '%');
    return { out, returnPct: (100 * out.net / out.wagered).toFixed(2) + '%', sdPct: (100 * 1.15 / Math.sqrt(out.hands)).toFixed(2) + '%', ranksPct: pct, cardsSeen: total, ups, dealerTotals };
  })()`);
  console.log(JSON.stringify(r, null, 1));
} finally { await close(); }
if (errors.length) { console.log('PAGE ERRORS:'); errors.forEach(e => console.log(' -', e)); process.exitCode = 2; }
