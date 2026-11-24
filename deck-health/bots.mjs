// Bots for the deck-health duel v0.
//  greedy — plays the card with the best average value assuming the opponent plays any card in
//           their hand evenly (hands sampled from public info). The ladder's reference player:
//           level with 'sound' head to head, and it punishes weak play. 'greedyblind' ignores face-up cards.
//  sound  — solves each clash as a small Bayesian game: samples the opponent's possible hands from
//           what's public (decklist, face-up discards, face-up returned cards), values outcomes by a
//           win-chance table over both deck counts (so lethal is exact), and plays the mixed strategy
//           regret matching converges to. Sensible discards (keep every type, then variety, then weight).
//  blind  — sound, but ignores the opponent's face-up returned cards (treats their hand as unknown).
//  half   — sound, but half its plays are a random card.
//  thumb  — rules-of-thumb player: random type among those held; Pressure plays its fastest,
//           Break its heaviest, Guard any. Sound discards. No reading.
//  heavy / light — always the heaviest / lightest card (lazy). Sound discards.
//  random — random card, random discards, random heal.
import { TYPES, clash, movesOf, single } from './engine.mjs';

// ---- win-chance table over deck counts (health) -------------------------------------------
const DIST = [
  [1, 0.3],
  [2, 0.4],
  [3, 0.3],
];
const MAXH = 40;
const W = [];
for (let a = 0; a <= MAXH; a++) W.push(new Float64Array(MAXH + 1));
for (let s = 0; s <= 2 * MAXH; s++) {
  for (let a = Math.max(0, s - MAXH); a <= Math.min(MAXH, s); a++) {
    const b = s - a;
    let v = 0;
    for (const [d, p] of DIST) {
      v += 0.5 * p * (d > a ? 0 : W[a - d][b]);
      v += 0.5 * p * (d > b ? 1 : W[a][b - d]);
    }
    W[a][b] = v;
  }
}
export function winChance(me, op) {
  return W[Math.min(MAXH, me)][Math.min(MAXH, op)];
}

// Value (−1..1) for me of a clash between my card a and their card b.
function outcomeValue(v, a, b, cfg) {
  const r = clash(a, b, v.myDiscard.length, v.opDiscard.length, cfg);
  const meDead = r.dmg[0] > v.myDeck;
  const opDead = r.dmg[1] > v.opDeck;
  if (meDead && opDead) return 0;
  if (meDead) return -1;
  if (opDead) return 1;
  return 2 * winChance(v.myDeck - r.dmg[0] + r.heal[0], v.opDeck - r.dmg[1] + r.heal[1]) - 1;
}

function pickWeighted(items, weights, R) {
  let t = R() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < items.length; i++) {
    t -= weights[i];
    if (t <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Sample the opponent's possible hands.
function sampleHands(v, R, S, blind) {
  const gone = new Set(v.opDiscard.map((c) => c.id));
  if (blind === 'cheat') return { hands: Array.from({ length: S }, () => v._opHand), pool: v._opHand };
  const known = blind ? [] : v.opKnown;
  for (const c of known) gone.add(c.id);
  const pool = v.decklist.filter((c) => !gone.has(c.id));
  const slots = v.opHandSize - known.length;
  const hands = [];
  for (let s = 0; s < S; s++) {
    const p = pool.slice();
    const h = known.slice();
    for (let k = 0; k < slots && p.length; k++) {
      const j = Math.floor(R() * p.length);
      h.push(p[j]);
      p[j] = p[p.length - 1];
      p.pop();
    }
    hands.push(h);
  }
  return { hands, pool: pool.concat(known) };
}

// Regret matching (CFR+) on me (one type) v opponent (one type per sampled hand).
export function soundStrategy(v, R, opts = {}) {
  const S = opts.samples || 30, T = opts.iters || 200;
  const A = v.hand;
  const { hands } = sampleHands(v, R, S, opts.blind);
  const ids = new Map();
  const opCards = [];
  for (const h of hands) for (const c of h) if (!ids.has(c.id)) { ids.set(c.id, opCards.length); opCards.push(c); }
  const pay = A.map((a) => opCards.map((b) => outcomeValue(v, a, b, v.cfg)));
  const H = hands.map((h) => h.map((c) => ids.get(c.id)));
  const nA = A.length;
  const rMe = new Float64Array(nA), avg = new Float64Array(nA);
  const rOp = H.map((h) => new Float64Array(h.length));
  const sig = new Float64Array(nA);
  for (let t = 1; t <= T; t++) {
    let z = 0;
    for (let i = 0; i < nA; i++) z += rMe[i];
    for (let i = 0; i < nA; i++) sig[i] = z > 0 ? rMe[i] / z : 1 / nA;
    const uMe = new Float64Array(nA);
    for (let s = 0; s < S; s++) {
      const h = H[s], r = rOp[s];
      let zo = 0;
      for (let j = 0; j < h.length; j++) zo += r[j];
      const tau = new Float64Array(h.length);
      for (let j = 0; j < h.length; j++) tau[j] = zo > 0 ? r[j] / zo : 1 / h.length;
      // my values against this sample
      for (let i = 0; i < nA; i++) {
        let u = 0;
        for (let j = 0; j < h.length; j++) u += tau[j] * pay[i][h[j]];
        uMe[i] += u / S;
      }
      // opponent's values (they minimise my value)
      const vo = new Float64Array(h.length);
      let base = 0;
      for (let j = 0; j < h.length; j++) {
        let u = 0;
        for (let i = 0; i < nA; i++) u -= sig[i] * pay[i][h[j]];
        vo[j] = u;
        base += tau[j] * u;
      }
      for (let j = 0; j < h.length; j++) r[j] = Math.max(0, r[j] + vo[j] - base);
    }
    let baseMe = 0;
    for (let i = 0; i < nA; i++) baseMe += sig[i] * uMe[i];
    for (let i = 0; i < nA; i++) rMe[i] = Math.max(0, rMe[i] + uMe[i] - baseMe);
    for (let i = 0; i < nA; i++) avg[i] += t * sig[i];
  }
  const z = avg.reduce((s, x) => s + x, 0);
  return Array.from(avg, (x) => x / z);
}

// Two-sided version: neither player sees the other's hand. My possible hands are sampled the way
// the opponent sees them (my face-up cards + the rest from my unseen pool), with my real hand as one
// of them; theirs likewise. Decks are separate, so the two hands are independent and the opponent's
// mix collapses to one distribution over their cards each iteration (cheap).
function sampleMine(v, R, S) {
  const known = v.hand.filter((c) => v.myKnown.has(c.id));
  const gone = new Set(v.myDiscard.map((c) => c.id));
  for (const c of known) gone.add(c.id);
  const pool = v.decklist.filter((c) => !gone.has(c.id));
  const out = [v.hand];
  for (let s = 1; s < S; s++) {
    const p = pool.slice(), h = known.slice();
    while (h.length < v.hand.length && p.length) {
      const j = Math.floor(R() * p.length);
      h.push(p[j]); p[j] = p[p.length - 1]; p.pop();
    }
    out.push(h);
  }
  return out;
}
export function sound2Strategy(v, R, opts = {}) {
  const S = opts.samples || 30, T = opts.iters || 300;
  const cfg = v.cfg;
  const mine = sampleMine(v, R, S).map((h) => movesOf(h, cfg));
  const theirs = sampleHands(v, R, S, opts.blind).hands.map((h) => movesOf(h, cfg));
  const idx = (hs) => {
    const m = new Map(), mv = [];
    for (const h of hs) for (const x of h) if (!m.has(x.id)) { m.set(x.id, mv.length); mv.push(x); }
    return { mv, H: hs.map((h) => h.map((x) => m.get(x.id))) };
  };
  const A = idx(mine), B = idx(theirs);
  const pay = A.mv.map((a) => B.mv.map((b) => outcomeValue(v, a, b, cfg)));
  const rA = A.H.map((h) => new Float64Array(h.length));
  const rB = B.H.map((h) => new Float64Array(h.length));
  const avg0 = new Float64Array(A.H[0].length);
  const rm = (r) => {
    let z = 0;
    for (const x of r) z += x;
    return Array.from(r, (x) => (z > 0 ? x / z : 1 / r.length));
  };
  for (let t = 1; t <= T; t++) {
    const P = new Float64Array(A.mv.length), Q = new Float64Array(B.mv.length);
    const sA = A.H.map((h, s) => { const g = rm(rA[s]); h.forEach((c, i) => (P[c] += g[i] / S)); return g; });
    const sB = B.H.map((h, s) => { const g = rm(rB[s]); h.forEach((c, j) => (Q[c] += g[j] / S)); return g; });
    const uA = A.mv.map((_, a) => { let u = 0; for (let b = 0; b < Q.length; b++) if (Q[b]) u += Q[b] * pay[a][b]; return u; });
    const uB = B.mv.map((_, b) => { let u = 0; for (let a = 0; a < P.length; a++) if (P[a]) u -= P[a] * pay[a][b]; return u; });
    A.H.forEach((h, s) => { let base = 0; h.forEach((c, i) => (base += sA[s][i] * uA[c])); h.forEach((c, i) => (rA[s][i] = Math.max(0, rA[s][i] + uA[c] - base))); });
    B.H.forEach((h, s) => { let base = 0; h.forEach((c, j) => (base += sB[s][j] * uB[c])); h.forEach((c, j) => (rB[s][j] = Math.max(0, rB[s][j] + uB[c] - base))); });
    for (let i = 0; i < avg0.length; i++) avg0[i] += t * sA[0][i];
  }
  const z = avg0.reduce((s, x) => s + x, 0);
  return { moves: mine[0], probs: Array.from(avg0, (x) => x / z) };
}

// Greedy over moves: the move with the best average value, assuming the opponent plays a single card
// evenly, or (with EX on) an EX pair a share e of the time.
export function greedyMove(v, R, { blind = false, allow = 'all', e = 0.15 } = {}) {
  const cfg = v.cfg;
  const { hands } = sampleHands(v, R, 40, blind);
  let mine = movesOf(v.hand, cfg);
  if (allow === 'single') mine = mine.filter((m) => !m.ex);
  if (allow === 'pairfirst' && mine.some((m) => m.ex)) mine = mine.filter((m) => m.ex);
  const theirMoves = hands.map((h) => {
    const ms = movesOf(h, cfg);
    const singles = ms.filter((m) => !m.ex), pairs = ms.filter((m) => m.ex);
    const ep = pairs.length ? e : 0;
    return ms.map((m) => [m, m.ex ? ep / pairs.length : (1 - ep) / singles.length]);
  });
  let best = null, bv = -Infinity;
  for (const a of mine) {
    let u = 0;
    for (const tm of theirMoves) for (const [b, w] of tm) u += w * outcomeValue(v, a, b, cfg);
    if (u > bv) { bv = u; best = a; }
  }
  return best;
}

// ---- discards and heals ---------------------------------------------------------------------
function combos(arr, n) {
  if (n === 0) return [[]];
  if (arr.length < n) return [];
  const out = [];
  for (let i = 0; i <= arr.length - n; i++) for (const rest of combos(arr.slice(i + 1), n - 1)) out.push([arr[i], ...rest]);
  return out;
}
function handScore(h) {
  const types = new Set(h.map((c) => c.type)).size;
  const kinds = new Set(h.map((c) => c.type + c.x)).size;
  const sx = h.reduce((s, c) => s + c.x, 0);
  const sr = h.reduce((s, c) => s + c.rank, 0);
  return 10 * types + 3 * kinds + 0.5 * sx - 0.01 * sr;
}
export function soundDiscard(v, n) {
  let best = null, bestS = -Infinity;
  for (const d of combos(v.hand, n)) {
    const ids = new Set(d.map((c) => c.id));
    const s = handScore(v.hand.filter((c) => !ids.has(c.id)));
    if (s > bestS) { bestS = s; best = d; }
  }
  return best;
}
export function soundKeep(v, move) {
  let best = move.cards[0], bs = -Infinity;
  for (const c of move.cards) {
    const sc = handScore([...v.hand.filter((h) => !move.cards.some((m) => m.id === h.id)), c]);
    if (sc > bs) { bs = sc; best = c; }
  }
  return best;
}
export function soundHeal(v) {
  return v.myDiscard.slice().sort((a, b) => b.x - a.x || a.rank - b.rank)[0];
}
function randomDiscard(v, n, R) {
  const h = v.hand.slice();
  const out = [];
  for (let k = 0; k < n; k++) out.push(h.splice(Math.floor(R() * h.length), 1)[0]);
  return out;
}
const rnd = (arr, R) => arr[Math.floor(R() * arr.length)];

// ---- bots ----------------------------------------------------------------------------------
export function makeBot(kind, opts = {}) {
  const sensible = { discard: (v, n) => soundDiscard(v, n), heal: (v) => soundHeal(v), keep: (v, m) => soundKeep(v, m) };
  switch (kind) {
    case 'sound1': {
      return {
        kind, ...sensible,
        choose(v, R) {
          if (v.hand.length === 1) return v.hand[0];
          return pickWeighted(v.hand, soundStrategy(v, R, opts), R);
        },
      };
    }
    case 'sound':
    case 'blind': {
      const blind = kind === 'blind';
      return {
        kind, ...sensible,
        choose(v, R) {
          if (v.hand.length === 1) return v.hand[0];
          const st = sound2Strategy(v, R, { ...opts, blind });
          return pickWeighted(st.moves, st.probs, R);
        },
      };
    }
    case 'cheat':
      return { kind, ...sensible, choose: (v, R) => pickWeighted(v.hand, soundStrategy(v, R, { ...opts, blind: 'cheat' }), R) };
    case 'rplay':
      return { kind, ...sensible, choose: (v, R) => rnd(v.hand, R) };
    case 'rdisc':
      return {
        kind,
        choose: (v, R) => { const st = sound2Strategy(v, R, opts); return pickWeighted(st.moves, st.probs, R); },
        discard: (v, n, R) => randomDiscard(v, n, R),
        heal: (v, R) => rnd(v.myDiscard, R),
      };
    case 'greedy':
    case 'greedyblind':
      return { kind, ...sensible, choose: (v, R) => greedyMove(v, R, { blind: kind === 'greedyblind' }) };
    case 'noex': // Greedy that never plays an EX pair
      return { kind, ...sensible, choose: (v, R) => greedyMove(v, R, { allow: 'single' }) };
    case 'alwaysex': // Greedy that always plays an EX pair when it holds one
      return { kind, ...sensible, choose: (v, R) => greedyMove(v, R, { allow: 'pairfirst' }) };
    case 'randomex': // uniform over every legal move, pairs included
      return {
        kind,
        choose: (v, R) => rnd(movesOf(v.hand, v.cfg), R),
        discard: (v, n, R) => randomDiscard(v, n, R),
        heal: (v, R) => rnd(v.myDiscard, R),
        keep: (v, m, R) => rnd(m.cards, R),
      };
    case 'half':
      return {
        kind, ...sensible,
        choose(v, R) {
          if (R() < (opts.noise ?? 0.5)) return rnd(v.hand, R);
          const st = sound2Strategy(v, R, opts);
          return pickWeighted(st.moves, st.probs, R);
        },
      };
    case 'thumb':
      return {
        kind, ...sensible,
        choose(v, R) {
          const types = TYPES.filter((t) => v.hand.some((c) => c.type === t));
          const t = rnd(types, R);
          const cs = v.hand.filter((c) => c.type === t);
          if (t === 'P') return cs.sort((a, b) => a.rank - b.rank)[0];
          if (t === 'B') return cs.sort((a, b) => b.x - a.x || a.rank - b.rank)[0];
          return rnd(cs, R);
        },
      };
    case 'heavy':
      return { kind, ...sensible, choose: (v) => v.hand.slice().sort((a, b) => b.x - a.x || a.rank - b.rank)[0] };
    case 'light':
      return { kind, ...sensible, choose: (v) => v.hand.slice().sort((a, b) => a.x - b.x || a.rank - b.rank)[0] };
    case 'random':
      return {
        kind,
        choose: (v, R) => rnd(v.hand, R),
        discard: (v, n, R) => randomDiscard(v, n, R),
        heal: (v, R) => rnd(v.myDiscard, R),
        keep: (v, m, R) => rnd(m.cards, R),
      };
    default:
      throw new Error('unknown bot ' + kind);
  }
}
