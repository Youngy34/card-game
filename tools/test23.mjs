// Rule checks for rules v23 (16 Nov, claude/rules v23 draft.md): v22 plus
//   Overdrive (3 Charge a round: your landed attacks build no Charge and deal their Charge as extra Damage);
//   no overload (a full battery takes no more); no specials, no Super;
//   the exchange (put a card from your hand into your discard pile, take a different one back);
//   every Guard draws a card on reveal, win or lose; Block, Breakfall (back to hand if a Break beats it),
//   Sidestep (your Pressures +2 speed next round); hand limit 9; time-outs by share of HP left.
//   node tools/test23.mjs

import fs from 'fs'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, heatOf, buyOptions20, applyBuy20, buy20, startDraw16, finishRound16, discardDown16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16, exchangeShortlist, chooseBuy20 } from '../src/engine/v16/ai.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../data/v23/settings.json')
const rules = { ...S.rules }, W = { ...DEFAULT_W16, ...S.ai }
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const J = { brawler: read('../data/v23/brawler.json'), zoner: read('../data/v23/zoner.json') }

// 0. Decks and settings
for (const n of ['brawler', 'zoner']) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  ok(f.cards.reduce((s, c) => s + c.copies, 0) === 30, `${n}: 30 cards`)
  ok(!f.cards.some(c => c.special) && f.super === null, `${n}: no specials, no Super`)
  ok(!f.cards.some(c => c.reveal), `${n}: no Read or Recall`)
  ok(f.cards.filter(c => c.type === 'recover').reduce((s, c) => s + c.copies, 0) === 9, `${n}: 9 Guards`)
}
ok(rules.overdrive === 3 && rules.exchange && rules.guardDraw && rules.timeoutShare && rules.handLimit === 9, 'v23 switches on')
ok(rules.greyOverflow && rules.overflowLost, 'no overload: Charge past the cap is lost')

const BR = toFighter16(J.brawler), ZO = toFighter16(J.zoner)
const id = (f, n) => f.cards.findIndex(c => c.name === n)
const base = (patchA = {}, patchB = {}, range = 'close', init = 0) => {
  const G = newGame16(BR, ZO, rules, 5)
  return { ...G, init, range, A: { ...G.A, at: range, ...patchA }, B: { ...G.B, at: range, ...patchB } }
}
const [JAB, HOOK, HAY, THROW, SLAM, BLOCK, STEP, FALL, RUSH] = ['Jab', 'Hook', 'Haymaker', 'Throw', 'Body Slam', 'Block', 'Step In', 'Breakfall', 'Rush Strike'].map(n => id(BR, n))
const [POKE, ZTHROW, ZBLOCK, SIDE, BACK] = ['Poke', 'Throw', 'Block', 'Sidestep', 'Backstep'].map(n => id(ZO, n))

// 1. Every revealed Guard draws, win or lose
{
  const G = base({ hand: [BLOCK, JAB] }, { hand: [ZTHROW, POKE] })
  const deckA = G.A.deck.length
  const g = startClash16(G, BLOCK, ZTHROW)
  ok(g.A.deck.length === deckA - 1 && g.A.hand.length === 2, `a beaten Block still draws (hand ${g.A.hand.length})`)
  ok(g.clash.winner === 1, 'Break beats Guard')
  const g2 = startClash16(base({ hand: [BLOCK, JAB] }, { hand: [ZBLOCK, POKE] }), BLOCK, ZBLOCK)
  ok(g2.A.hand.length === 2 && g2.B.hand.length === 2 && g2.clash.outcome === 'guards', 'two Guards: both draw, nothing else')
  const g3 = startClash16(base({ hand: [JAB, HOOK] }, { hand: [ZTHROW, POKE] }), JAB, POKE)
  ok(g3.A.hand.length === 1, 'an attack costs a card (no draw)')
}
// 2. No overload: Charge past the cap is lost, no damage
{
  const G = base({ hand: [HOOK, JAB] }, { hand: [ZTHROW], pile: 0 })
  const g0 = { ...G, B: { ...G.B, pile: 8 } }            // the Brawler (cap 9) holds 8 Charge
  const hp0 = g0.B.hp
  const g = startClash16(g0, HOOK, ZTHROW)              // Hook (Charge 3, Damage 2) beats Throw
  ok(g.B.pile === 9, `Charge stops at the cap (${g.B.pile})`)
  ok(g.B.hp === hp0 - 2, `no overload damage: only Hook's 2 (${hp0 - g.B.hp})`)
}
// 3. Overdrive: an option for 3 Charge; next round, landed attacks deal their Charge as Damage and build none
{
  let G = base({ hand: [HOOK, JAB, BLOCK] }, { hand: [ZTHROW, POKE] })
  G = { ...G, B: { ...G.B, pile: 5 }, phase: 'buy', buying: 0, buyLeft: [0, 1], bought: [null, null] }
  const o = buyOptions20(G, 0)
  ok(o.includes('O') && o.includes('M'), 'Overdrive and moving are options with 5 Charge')
  const g = applyBuy20(G, 0, 'O')
  ok(g.B.pile === 2 && g.A.odNext === true, 'Overdrive costs 3 and is on for the next round')
  const r = finishRound16({ ...g, phase: 'draw', discardDown: [0, 0] })
  ok(r.A.od === true && !r.A.odNext, 'next round the Brawler is in Overdrive')
  const hp0 = r.B.hp, pile0 = r.B.pile
  const c = startClash16({ ...r, range: 'close', A: { ...r.A, hand: [HOOK], at: 'close' }, B: { ...r.B, hand: [ZTHROW], at: 'close' } }, HOOK, ZTHROW)
  ok(c.B.hp === hp0 - 5 && c.B.pile === pile0, `Overdrive Hook: 2 + 3 Damage, no Charge built (${hp0 - c.B.hp}, Charge ${c.B.pile})`)
  const r2 = finishRound16({ ...c, phase: 'draw', discardDown: [0, 0] })
  ok(r2.A.od === false, 'not paid again: Overdrive ends')
  ok(!buyOptions20({ ...G, B: { ...G.B, pile: 2 } }, 0).includes('O'), 'no Overdrive with 2 Charge')
}
// 4. Overdrive with a flat bonus (the fallback switch)
{
  const R2 = { ...rules, odBonus: 1 }
  let G = newGame16(BR, ZO, R2, 5)
  G = { ...G, range: 'close', A: { ...G.A, at: 'close', hand: [HOOK], od: true }, B: { ...G.B, at: 'close', hand: [ZTHROW] } }
  const hp0 = G.B.hp, c = startClash16(G, HOOK, ZTHROW)
  ok(c.B.hp === hp0 - 3, `flat +1: Hook deals 3 (${hp0 - c.B.hp})`)
}
// 5. The exchange
{
  let G = base({ hand: [JAB, HOOK], discard: [{ i: THROW, burned: false }, { i: HAY, burned: false }] })
  G = { ...G, phase: 'buy', buying: 0, buyLeft: [0], bought: [null, null] }
  const o = buyOptions20(G, 0)
  ok(o.includes(`X:${JAB}:${THROW}`) && o.includes(`X:${HOOK}:${HAY}`) && !o.some(x => x === `X:${JAB}:${JAB}`), 'exchanges offered: any hand card for a different discard card')
  const g = applyBuy20(G, 0, `X:${JAB}:${THROW}`)
  ok(g.A.hand.includes(THROW) && !g.A.hand.includes(JAB) && g.A.discard.some(d => d.i === JAB) && !g.A.discard.some(d => d.i === THROW), 'Jab to the discard, Throw to the hand')
  ok(g.A.deck.length === G.A.deck.length, 'the exchange never touches the deck')
  ok((g.A.known || []).includes(THROW), 'the card taken is public')
  const short = exchangeShortlist(G, 0, o)
  ok(short.filter(x => typeof x === 'string' && x.startsWith('X:')).length <= 6, 'the partner weighs at most 6 exchanges')
  ok(!buyOptions20({ ...G, A: { ...G.A, discard: [] } }, 0).some(x => typeof x === 'string' && x.startsWith('X:')), 'no exchange from an empty pile')
}
// 5b. exchangeFree (test switch): an option and an exchange together
{
  const R2 = { ...rules, exchangeFree: true }
  let G = newGame16(BR, ZO, R2, 5)
  G = { ...G, range: 'close', A: { ...G.A, at: 'close', hand: [JAB, HOOK], discard: [{ i: THROW, burned: false }] }, B: { ...G.B, at: 'close', pile: 4 }, phase: 'buy', buying: 0, buyLeft: [0], bought: [null, null] }
  const o = buyOptions20(G, 0)
  ok(o.includes(`O|X:${JAB}:${THROW}`) && o.includes('O') && o.includes(`X:${JAB}:${THROW}`), 'free exchange: Overdrive and an exchange can go together')
  const g = applyBuy20(G, 0, `O|X:${JAB}:${THROW}`)
  ok(g.A.odNext && g.B.pile === 1 && g.A.hand.includes(THROW) && g.bought[0].od && g.bought[0].exchange, 'both applied')
}
// 6. Breakfall: back to hand if a Break beats it
{
  const G = base({ hand: [FALL, JAB] }, { hand: [ZTHROW] })
  const g = startClash16(G, FALL, ZTHROW)
  ok(g.clash.winner === 1 && g.A.hand.includes(FALL) && !g.A.used.includes(FALL), 'a Break beats Breakfall: it goes back to the hand')
  ok(g.A.hand.length === 3, `and it still drew (hand ${g.A.hand.length})`)
  const g2 = startClash16(base({ hand: [FALL, JAB] }, { hand: [POKE] }), FALL, POKE)
  ok(!g2.A.hand.includes(FALL), 'Breakfall that wins is used as normal')
}
// 7. Sidestep: on reveal, your Pressures +2 speed next round
{
  const G = base({ hand: [JAB] }, { hand: [SIDE, POKE] })
  const g = startClash16(G, JAB, SIDE)
  ok(g.B.next.speedUp === 2, 'Sidestep sets +2 speed for next round')
  const r = finishRound16({ ...g, phase: 'draw', discardDown: [0, 0], pending: null })
  // next round: Poke (16) +2 = 18 beats Jab (17)
  const c = startClash16({ ...r, init: 0, range: 'close', A: { ...r.A, hand: [JAB], at: 'close' }, B: { ...r.B, hand: [POKE], at: 'close' } }, JAB, POKE)
  ok(c.clash.winner === 1, 'Poke at 18 beats Jab at 17 the round after Sidestep')
}
// 8. Time-out by share of HP left
{
  const G = base({ hp: 12, deck: [] }, { hp: 9 })        // Brawler 12/24 = 50%, Zoner 9/16 = 56%
  const r = finishRound16({ ...G, phase: 'draw', discardDown: [0, 0] })
  ok(r.timedOut && r.result === 0, `the Zoner wins on share of HP (${r.result})`)
}
// 9. Whole games run, with Overdrive and exchanges taken
{
  let od = 0, ex = 0, games = 0, timeouts = 0
  for (let s = 1; s <= 6; s++) {
    const g = playGame18(BR, ZO, { rules, W, seed: s })
    games++; if (g.timedOut) timeouts++
    for (const r of g.rounds) for (const b of r.bought || []) { if (b?.od) od++; if (b?.exchange) ex++ }
    ok(g.result !== null, `game ${s} ends`)
  }
  ok(od > 0 && ex > 0, `the partner takes Overdrive (${od}) and exchanges (${ex}) in 6 games`)
}

console.log(`${passes}/${passes + fails} pass`)
process.exit(fails ? 1 : 0)
