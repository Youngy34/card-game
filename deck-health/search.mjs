// Search strike v2 card stats within family roles for a deck where every card earns a place
// in the card-against-card equilibrium. Scratch tool.
import { strike2Clash, rng } from './engine.mjs';
const R = rng(+process.argv[2] || 1);
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const fam = {
  P: () => ({ type: 'P', spd: ri(5, 6), pow: ri(1, 2), grd: ri(0, 1) }),
  B: () => ({ type: 'B', spd: ri(3, 4), pow: ri(2, 3), grd: ri(0, 1) }),
  G: () => ({ type: 'G', spd: ri(1, 2), pow: ri(1, 2), grd: ri(1, 2) }),
};
function solve(cards, T = 3000) {
  const k = cards.length;
  const M = cards.map((a) => cards.map((b) => { const r = strike2Clash(a, b); return r.dmg[1] - r.dmg[0]; }));
  const reg = new Float64Array(k), avg = new Float64Array(k);
  for (let t = 1; t <= T; t++) {
    let z = 0; for (const x of reg) z += Math.max(0, x);
    const s = Array.from(reg, (x) => (z > 0 ? Math.max(0, x) / z : 1 / k));
    const u = M.map((row) => row.reduce((acc, m, j) => acc + m * s[j], 0));
    const base = u.reduce((acc, x, i) => acc + x * s[i], 0);
    for (let i = 0; i < k; i++) { reg[i] = Math.max(0, reg[i] + u[i] - base); avg[i] += t * s[i]; }
  }
  const za = avg.reduce((a, b) => a + b, 0);
  const eq = Array.from(avg, (x) => x / za);
  const vs = M.map((row) => row.reduce((acc, m, j) => acc + m * eq[j], 0));
  return { eq, vs, M };
}
const key = (c) => `${c.spd}/${c.pow}/${c.grd}`;
let best = [];
for (let it = 0; it < 6000; it++) {
  const cards = [];
  for (const f of ['P', 'P', 'P', 'B', 'B', 'B', 'G', 'G', 'G']) {
    let c, tries = 0;
    do { c = fam[f](); tries++; } while (cards.some((d) => key(d) === key(c)) && tries < 30);
    cards.push(c);
  }
  if (new Set(cards.map(key)).size < 9) continue;
  const { eq, vs } = solve(cards);
  const worst = Math.min(...vs);
  const famShare = ['P', 'B', 'G'].map((f) => cards.reduce((s, c, i) => s + (c.type === f ? eq[i] : 0), 0));
  const minEq = Math.min(...eq);
  // score: every card close to break-even against the mix, every family used
  const score = worst * 10 + Math.min(...famShare) * 5 + minEq * 20;
  best.push({ score, worst, minEq, famShare, cards: cards.map(key), eq: eq.map((x) => +(100 * x).toFixed(1)) });
  best.sort((a, b) => b.score - a.score);
  best = best.slice(0, 5);
}
for (const b of best) console.log(JSON.stringify(b));
