#!/usr/bin/env node
/* Documentation screenshots through headless Chrome. usage: node tools/screenshots.mjs */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { launch, ROOT } from './headless.mjs';

const OUT = path.join(ROOT, 'docs', 'screenshots');
await fs.mkdir(OUT, { recursive: true });
const { page, errors, close } = await launch({ query: 'mute=1' });
const S = expr => page.eval(`(() => { ${expr} })()`);
/* the dealer's caption is set by hand per scene: the voice player runs on real time and would lag the virtual clock */
const shot = async (name, caption) => { await S(`BJ.ui.caption(${JSON.stringify(caption || '')}); return true;`); await page.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); await page.screenshot(path.join(OUT, name + '.jpg')); console.log('  saved docs/screenshots/' + name + '.jpg'); };
try {
  await shot('splash');
  await S(`BJ.game._nextLine = () => {}; BJ.ui.start(); BJ.step(2.0); BJ.game.addBet(25); BJ.game.addBet(25); return true;`); await shot('betting', 'Place your bets, please.');
  await S(`const g = BJ.game; g.hint = true; BJ.ui.el.hint.classList.add('on'); g.forced = ['10','10','8','10','6','9','8','8','9','10','3','10','2','9','K']; g.deal(); let n = 0; while (!(g.state === 'playing' && g.turn && g.turn.seat === 2) && n++ < 400) BJ.step(0.1); return g.state;`); await shot('turn', 'Good luck, everyone.');
  await S(`const g = BJ.game; g.act('split'); BJ.step(1.3); g.act('double'); BJ.step(1.5); g.act('double'); BJ.step(1.0); return true;`); await shot('split', 'Good luck, everyone.');
  await S(`const g = BJ.game; let n = 0; while (g.state !== 'dealer' && n++ < 300) BJ.step(0.1); BJ.step(1.4); return g.state;`); await shot('dealer', 'Dealer busts. Winners, well done.');
  await S(`const g = BJ.game; let n = 0; while (g.state !== 'settle' && n++ < 300) BJ.step(0.1); BJ.step(0.6); return g.state;`); await shot('settle', 'Nice hand.');
  await S(`const g = BJ.game; BJ.step(6); g.addBet(25); g.forced = ['10','10','A','10','A','9','9','K','9','K']; g.deal(); let n = 0; while (g.state !== 'insurance' && n++ < 400) BJ.step(0.1); return g.state;`); await shot('insurance', 'Insurance?');
  await S(`const g = BJ.game; g.insuranceDecision(false); let n = 0; while (g.state !== 'settle' && n++ < 400) BJ.step(0.1); BJ.step(0.5); return g.state;`); await shot('dealerbj', 'Dealer has blackjack.');
  await S(`BJ.game.showCount = true; BJ.ui.el.countPanel.classList.remove('hidden'); BJ.ui.toggleHelp(true); return true;`); await shot('help');
  await fs.copyFile(path.join(OUT, 'split.jpg'), path.join(OUT, 'hero.jpg'));
} finally { await close(); }
if (errors.length) { console.log('PAGE ERRORS:'); errors.forEach(e => console.log(' -', e)); process.exitCode = 2; } else console.log('no page errors');
