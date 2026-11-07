#!/usr/bin/env node
/* Headless smoke test: drives full rounds with forced shoes and asserts payouts,
   options and states. usage: node tools/smoke.mjs */
import { launch } from './headless.mjs';

const checks = []; let failed = 0;
function check(name, ok, info) { checks.push({ name, ok }); if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); }
const J = v => JSON.stringify(v);

const { page, errors, close } = await launch({ query: 'mute=1&fast=1' });
try {
  const S = async expr => page.eval(`(() => { ${expr} })()`);
  await S(`BJ.ui.start(); BJ.step(2.0); return true;`); /* the regulars bet 0.25–1.6 s after the table opens */
  let r = await S(`const g = BJ.game; return { state: g.state, bots: g.seats.filter(s => !s.human && s.active).map(s => s.bet), bankroll: g.seats[2].bankroll };`);
  check('betting opens; regulars have bets', r.state === 'betting' && r.bots.every(b => b >= 5) && r.bankroll === 1000, J(r));

  /* round 1: human blackjack, dealer busts */
  r = await S(`const g = BJ.game; g.addBet(25); g.addBet(25); g.forced = ['10','7','A','10','9','9','10','K','10','7','10']; const ok = g.deal(); let n = 0; while (g.state !== 'settle' && n++ < 400) BJ.step(0.1); const you = g.seats[2];
    return { ok, state: g.state, bankroll: you.bankroll, result: you.hands ? you.hands[0].result : null, dealer: g.dealer.cards.map(c => c.rank), dealerTotal: BJ.cards.handTotal(g.dealer.cards).total, dana: g.seats[0].hands ? g.seats[0].hands[0].result : null, victor: g.seats[4].hands ? g.seats[4].hands[0].result : null };`);
  check('blackjack pays 3:2, dealer busts, others win', r.ok && r.state === 'settle' && r.bankroll === 1075 && r.result === 75 && r.dealerTotal > 21 && r.dana > 0 && r.victor > 0, J(r));

  /* round 2: split eights, double both */
  r = await S(`const g = BJ.game; BJ.step(3.5); return { state: g.state, views: g.views.length };`);
  check('table cleared for the next round', r.state === 'betting' && r.views === 0, J(r));
  r = await S(`const g = BJ.game; g.addBet(25); g.forced = ['10','10','8','10','6','9','8','8','9','10','3','10','2','9','K']; g.deal(); let n = 0; while (!(g.state === 'playing' && g.turn && g.turn.seat === 2) && n++ < 400) BJ.step(0.1);
    const o = g.options(2, 0); return { state: g.state, turn: g.turn, options: o, hint: g.hintFor(2, 0) };`);
  check('human turn with a pair of eights: split offered and hinted', r.state === 'playing' && r.turn.seat === 2 && r.options.split && r.hint === 'P', J(r));
  r = await S(`const g = BJ.game; const a = g.act('split'); BJ.step(1.2); const first = g.seats[2].hands[0].cards.map(c => c.rank); const o1 = g.options(2, 0); const d1 = g.act('double'); BJ.step(1.4);
    const turn2 = g.turn; const o2 = g.options(2, 1); const d2 = g.act('double'); BJ.step(1.4); return { a, first, o1dbl: o1.double, d1, turn2, o2dbl: o2.double, d2, hands: g.seats[2].hands.map(h => ({ cards: h.cards.map(c => c.rank), bet: h.bet, doubled: h.doubled })) };`);
  check('split then double on both hands', r.a && r.d1 && r.d2 && r.hands.length === 2 && r.hands[0].bet === 50 && r.hands[1].bet === 50 && r.hands[0].cards.join() === '8,3,10' && r.hands[1].cards.join() === '8,2,9', J(r));
  r = await S(`const g = BJ.game; let n = 0; while (g.state !== 'settle' && n++ < 400) BJ.step(0.1); return { state: g.state, bankroll: g.seats[2].bankroll, results: g.seats[2].hands.map(h => h.result), dealer: g.dealer.cards.map(c => c.rank) };`);
  check('both doubled hands paid after dealer bust', r.state === 'settle' && r.bankroll === 1175 && r.results.join() === '50,50', J(r));

  /* round 3: insurance against a dealer blackjack */
  r = await S(`const g = BJ.game; BJ.step(3.5); g.addBet(25); g.forced = ['10','10','10','10','A','9','9','9','9','K']; g.deal(); let n = 0; while (g.state !== 'insurance' && n++ < 400) BJ.step(0.1); return { state: g.state, up: g.dealer.cards[0].rank };`);
  check('insurance offered against an ace', r.state === 'insurance' && r.up === 'A', J(r));
  r = await S(`const g = BJ.game; g.insuranceDecision(true); let n = 0; while (g.state !== 'settle' && n++ < 400) BJ.step(0.1); return { state: g.state, bankroll: g.seats[2].bankroll, dealerNatural: BJ.cards.handTotal(g.dealer.cards).natural, result: g.seats[2].hands[0].result };`);
  check('dealer blackjack: insurance covers the lost bet', r.state === 'settle' && r.dealerNatural && r.bankroll === 1175 && r.result === 0, J(r));

  /* round 4: surrender 16 vs 10 */
  r = await S(`const g = BJ.game; BJ.step(3.5); g.addBet(25); g.forced = ['10','10','10','10','10','9','9','6','9','7']; g.deal(); let n = 0; while (!(g.state === 'playing' && g.turn && g.turn.seat === 2) && n++ < 400) BJ.step(0.1);
    const o = g.options(2, 0), hint = g.hintFor(2, 0), ok = g.act('surrender'); n = 0; while (g.state !== 'settle' && n++ < 400) BJ.step(0.1); return { o: o.surrender, hint, ok, state: g.state, bankroll: g.seats[2].bankroll, result: g.seats[2].hands[0].result };`);
  check('late surrender returns half the bet', r.o && r.hint === 'R' && r.ok && r.state === 'settle' && r.bankroll === 1162.5 && r.result === -12.5, J(r));

  /* count and reshuffle */
  r = await S(`const g = BJ.game; const rc = g.runningCount, decks = g.decksLeft(); g.shoePos = g.shoe.length - 40; BJ.step(3.5); return { rcType: typeof rc, decks, afterState: g.state, shoePos: g.shoePos, rc: g.runningCount };`);
  check('cut card reached: shoe reshuffled and count reset', r.rcType === 'number' && r.decks < 6 && r.afterState === 'betting' && r.shoePos === 0 && r.rc === 0, J(r));

  /* second human seat + random rounds */
  r = await S(`const g = BJ.game; g.toggleSecondSeat(); const open = g.seats[3].active; g.selectSeat(2); g.addBet(25, 2); g.addBet(25, 3); g.forced = null; g.deal(); let n = 0; while (g.state !== 'settle' && n++ < 800) { if (g.state === 'playing' && g.turn && g.seats[g.turn.seat].human) g.act(g.hintFor(g.turn.seat, g.turn.hand) === 'D' ? 'double' : g.hintFor(g.turn.seat, g.turn.hand) === 'P' ? 'split' : g.hintFor(g.turn.seat, g.turn.hand) === 'R' ? 'surrender' : g.hintFor(g.turn.seat, g.turn.hand) === 'S' ? 'stand' : 'hit'); BJ.step(0.1); } return { open, state: g.state, seat3: g.seats[3].hands && g.seats[3].hands.length };`);
  check('second seat plays a full random round with hints', r.open && r.state === 'settle' && r.seat3 >= 1, J(r));
  r = await S(`const g = BJ.game; let rounds = 0; for (let k = 0; k < 6; k++) { BJ.step(3.5); if (g.state !== 'betting') break; g.rebet(); if (!g.deal()) break; let n = 0; while (g.state !== 'settle' && n++ < 800) { if (g.state === 'insurance') g.insuranceDecision(false); if (g.state === 'playing' && g.turn && g.seats[g.turn.seat].human) { const h = g.hintFor(g.turn.seat, g.turn.hand); g.act(h === 'D' ? 'double' : h === 'P' ? 'split' : h === 'R' ? 'surrender' : h === 'S' ? 'stand' : 'hit'); } BJ.step(0.1); } if (g.state === 'settle') rounds++; } return { rounds, stats: g.stats, bankroll: g.seats[2].bankroll + g.seats[3].bankroll };`);
  check('six more random rounds complete', r.rounds === 6, J(r));
  r = await S(`const A = BJ.audio; const errs = []; ['cardSlide','cardSnap','cardFlip','shoePull','shuffle','chipPlace','chipTake','bustThud','pushTone','deny','uiTick'].forEach(k => { try { A[k](); } catch (e) { errs.push(k + ': ' + e.message); } }); try { A.chipPay(5); A.winChime(true); A.playClip('blackjack'); } catch (e) { errs.push(e.message); } return { errs, ctx: A.ctx && A.ctx.state, clips: Object.keys(A.clipsRaw).length };`);
  check('audio routines run without exceptions', r.errs.length === 0 && r.clips >= 15, J(r));
} finally { await close(); }
if (errors.length) { console.log('\nPAGE ERRORS:'); errors.forEach(e => console.log(' -', e)); }
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed' + (errors.length ? ', ' + errors.length + ' page error(s)' : ', no page errors'));
process.exitCode = failed || errors.length ? 2 : 0;
