// Deck-health duel (Branch B) — v0 engine. Standalone: no imports from the Guardbreakers code.
//
// Rules v0 (see README.md):
//  - Each player: own 20-card deck. Shuffle, draw 5.
//  - Each round: draw up to 5 (if you need more cards than your deck holds, you lose;
//    both at once = draw). Both pick a card face down, reveal.
//  - Different types: Pressure > Break > Guard > Pressure. Same type: lower rank (faster) wins;
//    equal rank = tie, both discard their card.
//  - Loser discards their card + the winner's +x cards from hand (loser's choice, face up).
//  - Winner takes their card back, face up (known to the opponent while it stays in hand).
//  - A winning Guard heals: put one card from your discard pile on the bottom of your deck.

export const TYPES = ['P', 'B', 'G'];
export const BEATS = { P: 'B', B: 'G', G: 'P' };
export const TYPE_NAME = { P: 'Pressure', B: 'Break', G: 'Guard' };

// +x from rank: A–4 light (+0), 5–9 medium (+1), 10–K heavy (+2). Speed = rank (lower is faster).
export function bandX(rank, bands = [4, 9]) {
  return rank <= bands[0] ? 0 : rank <= bands[1] ? 1 : 2;
}

export const DECKS = {
  // v0: Pressure = clubs A–8, Break = spades 8–K, Guard = hearts A–3 and 5–7.
  v0: { P: [1, 2, 3, 4, 5, 6, 7, 8], B: [8, 9, 10, 11, 12, 13], G: [1, 2, 3, 5, 6, 7] },
  // Quick-check variants (not adopted): 18 cards (one light Pressure and one light Guard out).
  v0_18: { P: [1, 2, 3, 5, 6, 7, 8], B: [8, 9, 10, 11, 12, 13], G: [1, 2, 5, 6, 7] },
};

export function makeDecklist(spec, cfg = {}) {
  const out = [];
  let id = 0;
  for (const t of TYPES)
    for (const r of spec[t] || []) {
      // guard1: every Guard is the same card — no speed, no +x.
      if (cfg.guard1 && t === 'G') out.push({ id: id++, type: t, rank: 0, x: 0 });
      else out.push({ id: id++, type: t, rank: r, x: bandX(r, cfg.bands) });
    }
  return out;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, R) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A move: one card, or (with cfg.ex) an EX pair of two cards of one type.
// { cards, type, rank (speed: the fastest card's), x (the heaviest card's), ex }
export function single(c) {
  return { cards: [c], type: c.type, rank: c.rank, x: c.x, ex: false, id: c.id };
}
export function pair(c1, c2) {
  return { cards: [c1, c2], type: c1.type, rank: Math.min(c1.rank, c2.rank), x: Math.max(c1.x, c2.x), ex: true, id: c1.id * 100 + c2.id + 10000 };
}
export function movesOf(hand, cfg = {}) {
  const out = hand.map(single);
  if (cfg.ex)
    for (let i = 0; i < hand.length; i++)
      for (let j = i + 1; j < hand.length; j++)
        if (hand[i].type === hand[j].type && !(cfg.guard1 && hand[i].type === 'G')) out.push(pair(hand[i], hand[j]));
  return out;
}
const asMove = (m) => (m.cards ? m : single(m));

// Pure clash resolution. a, b: moves (or cards). discA/discB: discard-pile sizes (for the Guard heal).
// Returns { w: 0 | 1 | -1 (tie), dmg: [d0, d1], heal: [h0, h1] }. dmg counts every card each side loses.
export function clash(a, b, discA = 1, discB = 1, cfg = {}) {
  a = asMove(a); b = asMove(b);
  const heal = cfg.heal !== false;
  const nA = a.cards.length, nB = b.cards.length;
  // guard1: two Guards meeting — nothing happens (w = -2), both cards go back.
  if (cfg.guard1 && a.type === 'G' && b.type === 'G') {
    // 'fatigue' variant: both discard their Guard (a tie). Default: nothing happens.
    if (cfg.guardMirror === 'fatigue') return { w: -1, dmg: [1, 1], heal: [0, 0] };
    return { w: -2, dmg: [0, 0], heal: [0, 0] };
  }
  let w;
  if (a.type !== b.type) w = BEATS[a.type] === b.type ? 0 : 1;
  else if (a.ex !== b.ex) w = a.ex ? 0 : 1;
  else if (a.rank !== b.rank) w = a.rank < b.rank ? 0 : 1;
  else w = -1;
  if (w === -1) return { w, dmg: [nA, nB], heal: [0, 0] };
  const win = w === 0 ? a : b;
  const dmg = w === 0 ? [nA - 1, nB + win.x] : [nA + win.x, nB - 1];
  const h = [0, 0];
  if (heal && win.type === 'G' && (w === 0 ? discA : discB) > 0) h[w] = 1;
  return { w, dmg, heal: h };
}

export function newGame(spec, R, cfg = {}) {
  const hand = cfg.hand || 5;
  const players = [0, 1].map(() => {
    const deck = shuffle(makeDecklist(spec, cfg), R);
    const p = { deck, hand: [], known: new Set(), discard: [], healedBottom: [] };
    for (let i = 0; i < hand; i++) p.hand.push(p.deck.pop());
    return p;
  });
  return { players, spec, cfg, handSize: hand, round: 0, decklist: makeDecklist(spec, cfg) };
}

// What player i can see.
export function view(g, i) {
  const me = g.players[i], op = g.players[1 - i];
  return {
    me: i,
    hand: me.hand.slice(),
    myKnown: new Set(me.known),
    myDeck: me.deck.length,
    myDiscard: me.discard.slice(),
    opDeck: op.deck.length,
    opKnown: op.hand.filter((c) => op.known.has(c.id)),
    opHandSize: op.hand.length,
    opDiscard: op.discard.slice(),
    decklist: g.decklist,
    round: g.round,
    _opHand: op.hand.slice(), // hidden: only the 'cheat' diagnostic bot reads this
    cfg: g.cfg,
  };
}

// Plays one game. bots: [bot0, bot1] with choose(view, R) -> card, discard(view, n, R) -> [cards], heal(view, R) -> card.
// Returns a record with the winner (0, 1, or -1 for a draw), rounds and per-round logs for stats.
export function playGame(spec, bots, R, cfg = {}) {
  const g = newGame(spec, R, cfg);
  const log = [];
  const cap = cfg.cap || 200;
  while (g.round < cap) {
    // Draw step.
    const need = g.players.map((p) => g.handSize - p.hand.length);
    const out = g.players.map((p, i) => need[i] > p.deck.length);
    if (out[0] || out[1]) {
      const winner = out[0] && out[1] ? -1 : out[0] ? 1 : 0;
      return { winner, rounds: g.round, log, g };
    }
    g.players.forEach((p, i) => {
      for (let k = 0; k < need[i]; k++) p.hand.push(p.deck.pop());
    });
    g.round++;
    const views = [view(g, 0), view(g, 1)];
    const missing = views.map((v) => TYPES.filter((t) => !v.hand.some((c) => c.type === t)).length);
    const picks = [asMove(bots[0].choose(views[0], R)), asMove(bots[1].choose(views[1], R))];
    const res = clash(picks[0], picks[1], g.players[0].discard.length, g.players[1].discard.length, cfg);
    const entry = {
      round: g.round,
      picks,
      hands: views.map((v) => v.hand),
      res,
      deckBefore: g.players.map((p) => p.deck.length),
      missing,
      opKnownCount: views.map((v) => v.opKnown.length),
    };
    // Remove played cards from hands.
    g.players.forEach((p, i) => {
      const ids = new Set(picks[i].cards.map((c) => c.id));
      p.hand = p.hand.filter((c) => !ids.has(c.id));
      for (const id of ids) p.known.delete(id);
    });
    if (res.w === -1) {
      g.players.forEach((p, i) => p.discard.push(...picks[i].cards));
    } else if (res.w === -2) {
      g.players.forEach((p, i) => { for (const c of picks[i].cards) { p.hand.push(c); p.known.add(c.id); } });
    } else {
      const w = res.w, l = 1 - w;
      const W = g.players[w], L = g.players[l];
      // Winner's card back, face up (an EX winner keeps one of the two, their choice; the other is discarded).
      let back = picks[w].cards[0];
      if (picks[w].ex) {
        back = bots[w].keep ? bots[w].keep(view(g, w), picks[w], R) : picks[w].cards[0];
        W.discard.push(...picks[w].cards.filter((c) => c.id !== back.id));
      }
      W.hand.push(back);
      W.known.add(back.id);
      // Loser: card(s) + x from hand.
      L.discard.push(...picks[l].cards);
      const n = Math.min(picks[w].x, L.hand.length);
      if (n > 0) {
        const lv = view(g, l);
        const ds = bots[l].discard(lv, n, R);
        if (ds.length !== n) throw new Error('bad discard count');
        for (const d of ds) {
          const idx = L.hand.findIndex((c) => c.id === d.id);
          if (idx < 0) throw new Error('discard not in hand');
          L.hand.splice(idx, 1);
          L.known.delete(d.id);
          L.discard.push(d);
        }
        entry.discarded = ds;
      }
      if (res.heal[w]) {
        const hv = view(g, w);
        const hc = bots[w].heal(hv, R);
        const idx = W.discard.findIndex((c) => c.id === hc.id);
        if (idx < 0) throw new Error('heal not in discard');
        W.discard.splice(idx, 1);
        W.deck.unshift(hc); // bottom of deck (deck top = end of array)
        entry.healed = hc;
      }
    }
    log.push(entry);
  }
  return { winner: -1, rounds: g.round, log, g, capped: true };
}
