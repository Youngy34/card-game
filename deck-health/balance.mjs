#!/usr/bin/env node
// Static balance check for strike decks: the card-against-card game (net cards: theirs lost minus yours),
// solved for its equilibrium mix by regret matching. Ignores hands, lethal and information — a first filter only.
//   node deck-health/balance.mjs strike2
import { DECKS, strike2Clash, strikeClash } from './engine.mjs';
const name = process.argv[2] || 'strike2';
const v1 = process.argv.includes('--v1');
const cards = DECKS[name].cards.map(([nm, type, spd, pow, grd, n]) => ({ nm, type, spd, pow, grd, n }));
const k = cards.length;
const M = cards.map((a) => cards.map((b) => { const r = (v1 ? strikeClash : strike2Clash)(a, b); return r.dmg[1] - r.dmg[0]; }));
const reg = new Float64Array(k), avg = new Float64Array(k);
for (let t = 1; t <= 20000; t++) {
  let z = 0; for (const x of reg) z += Math.max(0, x);
  const s = Array.from(reg, (x) => (z > 0 ? Math.max(0, x) / z : 1 / k));
  const u = M.map((row) => row.reduce((acc, m, j) => acc + m * s[j], 0));
  const base = u.reduce((acc, x, i) => acc + x * s[i], 0);
  for (let i = 0; i < k; i++) { reg[i] = Math.max(0, reg[i] + u[i] - base); avg[i] += t * s[i]; }
}
const za = avg.reduce((a, b) => a + b, 0);
const eq = Array.from(avg, (x) => x / za);
const vs = M.map((row) => row.reduce((acc, m, j) => acc + m * eq[j], 0));
const pad = (x, n = 7) => String(x).padStart(n);
console.log('card'.padEnd(12) + cards.map((c) => pad(c.nm.slice(0, 6))).join('') + '   eq mix   v eq');
cards.forEach((c, i) => console.log(`${c.nm.padEnd(12)}${M[i].map((m) => pad(m)).join('')}   ${pad((100 * eq[i]).toFixed(1) + '%', 6)}  ${pad(vs[i].toFixed(2), 6)}`));
console.log('(rows: net cards for the row card; eq mix: share a perfect player uses; v eq: each card against that mix, 0 = as good as the best)');
