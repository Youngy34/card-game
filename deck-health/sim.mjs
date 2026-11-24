#!/usr/bin/env node
// Deck-health duel sim.
//   node deck-health/sim.mjs mirror [-n 1000] [--seed 1] [--deck v0] [--bot sound]
//   node deck-health/sim.mjs vs A B [-n 400]        (A against B, both seats; A's win rate)
//   node deck-health/sim.mjs ladder [-n 400]        (every bot against sound)
// Options: --noheal (Guard heal off), --bands 4,9 (rank cut-offs for +0/+1/+2)
import { DECKS, TYPES, playGame, rng } from './engine.mjs';
import { makeBot } from './bots.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const N = +opt('-n', 400);
const SEED = +opt('--seed', 1);
const deckName = opt('--deck', 'v0');
const spec = DECKS[deckName];
const cfg = { heal: !args.includes('--noheal'), ex: args.includes('--ex'), guard1: args.includes('--guard1'), guardMirror: opt('--gmirror', 'bounce') };
if (opt('--bands')) cfg.bands = opt('--bands').split(',').map(Number);
const pos = args.filter((a, i) => !a.startsWith('-') && !(i > 0 && args[i - 1].startsWith('-')));
const cmd = pos[0] || 'mirror';
const REF = opt('--ref', 'greedy');

const pct = (x) => (100 * x).toFixed(1) + '%';
const ci = (p, n) => (196 * Math.sqrt((p * (1 - p)) / n)).toFixed(1);

function run(kindA, kindB, n, seed, seat = 0) {
  const R = rng(seed);
  const games = [];
  for (let k = 0; k < n; k++) {
    const bots = seat === 0 ? [makeBot(kindA), makeBot(kindB)] : [makeBot(kindB), makeBot(kindA)];
    games.push(playGame(spec, bots, R, cfg));
  }
  return games;
}

function vs(a, b, n, seed) {
  const g0 = run(a, b, n, seed, 0), g1 = run(a, b, n, seed + 7777, 1);
  let w = 0, d = 0, rounds = 0;
  for (const g of g0) { if (g.winner === 0) w++; else if (g.winner === -1) d++; rounds += g.rounds; }
  for (const g of g1) { if (g.winner === 1) w++; else if (g.winner === -1) d++; rounds += g.rounds; }
  const tot = 2 * n;
  return { a, b, win: (w + d / 2) / tot, draws: d / tot, rounds: rounds / tot, n: tot };
}

function mirrorStats(kind, n, seed) {
  const games = run(kind, kind, n, seed);
  const rounds = games.map((g) => g.rounds).sort((a, b) => a - b);
  const q = (p) => rounds[Math.floor(p * (rounds.length - 1))];
  let bounces = 0;
  let seat0 = 0, draws = 0, ties = 0, clashes = 0, heals = 0, capped = 0;
  const xPlays = [0, 0, 0], typePlays = { P: 0, B: 0, G: 0 };
  const within = {}; // type -> {light, heavy, other, n}
  let missingHands = 0, hands = 0, comebacks = 0, decided = 0, streakSum = 0;
  let exMoves = 0, exWins = 0, exLosses = 0, exTies = 0;
  let knownSum = 0, dmgSum = 0, decidedClashes = 0, loserLost = 0, winnerLost = 0, healsW = 0;
  for (const g of games) {
    if (g.capped) capped++;
    if (g.winner === 0) seat0++;
    if (g.winner === -1) draws++;
    let behind4 = false, streak = 0, best = 0, last = null;
    for (const e of g.log) {
      clashes++;
      if (e.res.w === -1) ties++;
      if (e.res.w === -2) bounces++;
      if (e.healed) heals++;
      if (e.res.w >= 0) { decidedClashes++; dmgSum += e.res.dmg[1 - e.res.w]; }
      if (g.winner >= 0) { loserLost += e.res.dmg[1 - g.winner]; winnerLost += e.res.dmg[g.winner]; if (e.healed && e.res.w === g.winner) healsW++; }
      for (let i = 0; i < 2; i++) {
        const c = e.picks[i];
        xPlays[c.x]++;
        if (c.ex) { exMoves++; if (e.res.w === i) exWins++; else if (e.res.w === -1) exTies++; else exLosses++; }
        typePlays[c.type]++;
        hands++;
        if (e.missing[i] > 0) missingHands++;
        knownSum += e.opKnownCount[i];
        const same = e.hands[i].filter((h) => h.type === c.type);
        const xs = new Set(same.map((h) => h.x));
        if (xs.size >= 2) {
          const w = (within[c.type] ||= { light: 0, heavy: 0, mid: 0, n: 0 });
          const lo = Math.min(...xs), hi = Math.max(...xs);
          w.n++;
          if (c.x === lo) w.light++;
          else if (c.x === hi) w.heavy++;
          else w.mid++;
        }
      }
      if (g.winner >= 0) {
        const wd = e.deckBefore[g.winner], ld = e.deckBefore[1 - g.winner];
        if (ld - wd >= 4) behind4 = true;
      }
      if (e.res.w >= 0) {
        streak = e.res.w === last ? streak + 1 : 1;
        last = e.res.w;
        best = Math.max(best, streak);
      } else { streak = 0; last = null; }
    }
    streakSum += best;
    if (g.winner >= 0) { decided++; if (behind4) comebacks++; }
  }
  const plays = xPlays.reduce((s, x) => s + x, 0);
  const mean = rounds.reduce((s, x) => s + x, 0) / n;
  const out = [];
  out.push(`${kind} mirror, ${n} games, deck ${deckName}, heal ${cfg.heal ? 'on' : 'off'}, EX ${cfg.ex ? 'on' : 'off'}, guard1 ${cfg.guard1 ? 'on' : 'off'}, seed ${seed}`);
  out.push(`  rounds: mean ${mean.toFixed(1)}, median ${q(0.5)}, p10 ${q(0.1)}, p90 ${q(0.9)}, min ${rounds[0]}, max ${rounds[n - 1]}${capped ? `, capped ${capped}` : ''}`);
  out.push(`  seat 1 wins ${pct(seat0 / n)} (±${ci(seat0 / n, n)}), draws ${pct(draws / n)}`);
  if (cfg.guard1) out.push(`  Guard mirrors (nothing happens) ${pct(bounces / clashes)} of clashes`);
  out.push(`  ties ${pct(ties / clashes)} of clashes; heals ${(heals / n).toFixed(2)} a game; longest win streak ${(streakSum / n).toFixed(1)} on average`);
  out.push(`  plays by weight: +0 ${pct(xPlays[0] / plays)}, +1 ${pct(xPlays[1] / plays)}, +2 ${pct(xPlays[2] / plays)}`);
  if (cfg.ex) out.push(`  EX pairs: ${pct(exMoves / plays)} of moves (${(exMoves / n).toFixed(2)} a game); they win ${pct(exWins / Math.max(1, exMoves))}, lose ${pct(exLosses / Math.max(1, exMoves))}, tie ${pct(exTies / Math.max(1, exMoves))}`);
  out.push(`  plays by type: ${TYPES.map((t) => `${t} ${pct(typePlays[t] / plays)}`).join(', ')}`);
  for (const t of TYPES) if (within[t]) {
    const w = within[t];
    out.push(`  ${t} played while holding 2+ weights of it (${w.n}): lightest ${pct(w.light / w.n)}, heaviest ${pct(w.heavy / w.n)}${w.mid ? `, middle ${pct(w.mid / w.n)}` : ''}`);
  }
  out.push(`  hands missing a type at reveal ${pct(missingHands / hands)}; opponent's known cards ${(knownSum / hands).toFixed(2)} a round on average`);
  out.push(`  damage per decided clash ${(dmgSum / decidedClashes).toFixed(2)}; per decided game the loser lost ${(loserLost / decided).toFixed(1)} cards, the winner ${(winnerLost / decided).toFixed(1)} (and healed ${(healsW / decided).toFixed(1)})`);
  out.push(`  comebacks (winner was 4+ cards behind at some point) ${pct(comebacks / decided)}`);
  return out.join('\n');
}

if (cmd === 'mirror') {
  console.log(mirrorStats(opt('--bot', 'sound'), N, SEED));
} else if (cmd === 'vs') {
  const r = vs(pos[1], pos[2], N, SEED);
  console.log(`${r.a} v ${r.b}: ${r.a} wins ${pct(r.win)} (±${ci(r.win, r.n)}), draws ${pct(r.draws)}, rounds ${r.rounds.toFixed(1)}, ${r.n} games`);
} else if (cmd === 'ladder') {
  const bots = (opt('--bots', 'random,thumb,half,blind,heavy,light')).split(',');
  for (const b of bots) {
    const r = vs(b, REF, N, SEED);
    console.log(`${b.padEnd(11)} v ${REF}: ${pct(r.win)} (±${ci(r.win, r.n)}), draws ${pct(r.draws)}, rounds ${r.rounds.toFixed(1)}, ${r.n} games`);
  }
}
