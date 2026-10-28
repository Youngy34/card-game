// Hand-checked rules v14 situations, run against the engine.
//
//   node v14/tools/test-engine.mjs
//
// Each case is worked out from rules-overview 14.md and the draft fighters.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { newGame, reveal, options, missingTypes } from '../src/engine/engine.js'
import { toEngineFighter, validateFighter } from '../src/engine/fighters.js'
import { beats, beatsList, losesTo, cardText } from '../src/engine/rules.js'
import { mixes, newContext } from '../src/engine/ai.js'
import { playAIGame, mulberry32, winRoute } from '../src/engine/game.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = id => JSON.parse(fs.readFileSync(path.join(root, `data/fighters/${id}.json`), 'utf8'))
const BEN = load('benchmark'), VEX = load('vex'), ATLAS = load('atlas')
const ben = toEngineFighter(BEN), vex = toEngineFighter(VEX), atlas = toEngineFighter(ATLAS)
const idx = (f, t) => { const i = f.cards.findIndex(c => c.t === t); if (i < 0) throw new Error(t); return i }

let checks = 0, fails = 0
const eq = (got, want, what) => {
  checks++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fails++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`) }
}
const throws = (fn, what) => { checks++; try { fn(); fails++; console.log(`FAIL ${what}: no error`) } catch { /* ok */ } }

// files validate, with no guideline warnings
for (const f of [BEN, VEX, ATLAS]) {
  const v = validateFighter(f)
  eq([v.errors, v.warnings], [[], []], `${f.name} validates cleanly`)
}

// ---- the wheel ----
eq(['H', 'G', 'F', 'B'].map(y => beats('v14', 'S', y)), [true, true, false, false], 'Strike beats Heavy and Grab, loses to Focus and Block')
eq([beatsList('v14', 'B'), losesTo('v14', 'B')], [['S', 'H'], ['F', 'G']], 'Block beats Strike and Heavy, loses to Focus and Grab')
eq([beatsList('v14', 'F'), losesTo('v14', 'F')], [['B', 'S'], ['G', 'H']], 'Focus beats Block and Strike, loses to Grab and Heavy')
eq([beatsList('v14', 'H'), beatsList('v14', 'G')], [['G', 'F'], ['F', 'B']], 'Heavy beats Grab and Focus; Grab beats Focus and Block')
eq([beatsList('first', 'B'), beatsList('first', 'F')], [['F', 'S'], ['S', 'H']], 'First-draft wheel: Block beats Focus and Strike; Focus beats Strike and Heavy')
eq([beatsList('alt', 'G'), beatsList('alt', 'F')], [['H', 'B'], ['S', 'G']], 'Alternative wheel: Grab beats Heavy and Block; Focus beats Strike and Grab')
let allPairs = true
for (const w of ['v14', 'first', 'alt']) for (const x of 'SHGFB') for (const y of 'SHGFB') if (x !== y && beats(w, x, y) === beats(w, y, x)) allPairs = false
eq(allPairs, true, 'Every pair of different types has exactly one winner, on every wheel')

// ---- every pairing, Benchmark vs Benchmark, piles 4 (A) and 6 (B) ----
const B = t => idx(ben, t)
const board = (pa = 4, pb = 6, rules = {}, fa = ben, fb = ben) => {
  const G = newGame(fa, fb, rules)
  G.A = { ...G.A, pile: pa }; G.B = { ...G.B, pile: pb }
  return G
}
const after = r => [r.G.A.hp, r.G.A.pile, r.G.B.hp, r.G.B.pile]
{
  let r = reveal(board(), B('S'), B('H'))
  eq([r.ev.result, r.ev.by, after(r)], ['hit', 0, [20, 4, 19, 9]], 'Strike beats Heavy: 3 grey and 1 chip on B')
  r = reveal(board(), B('S'), B('G'))
  eq([r.ev.result, after(r)], ['hit', [20, 4, 19, 9]], 'Strike beats Grab')
  r = reveal(board(), B('S'), B('F'))
  eq([r.ev.result, r.ev.by, after(r)], ['clear', 1, [20, 4, 20, 0]], 'Focus beats Strike: B clears their own pile; the striker loses nothing')
  r = reveal(board(), B('S'), B('B'))
  eq([r.ev.result, r.ev.by, after(r)], ['turnback', 1, [20, 7, 20, 6]], "Block beats Strike: the Strike's 3 grey goes on the striker's own pile")
  r = reveal(board(), B('H'), B('G'))
  eq([r.ev.result, r.ev.cashed, after(r)], ['cash', [0, 6], [20, 4, 12, 0]], 'Heavy beats Grab: cashes 6, then 2 chip')
  r = reveal(board(), B('H'), B('F'))
  eq([r.ev.result, after(r)], ['cash', [20, 4, 12, 0]], 'Heavy beats Focus: cashes the pile the Focus was trying to clear')
  r = reveal(board(), B('H'), B('B'))
  eq([r.ev.result, r.ev.by, after(r)], ['stopped', 1, [20, 4, 20, 6]], 'Block beats Heavy: it is simply stopped')
  r = reveal(board(), B('G'), B('F'))
  eq([r.ev.result, after(r)], ['cash', [20, 4, 12, 0]], 'Grab beats Focus: cash 6 + 2')
  r = reveal(board(), B('G'), B('B'))
  eq([r.ev.result, after(r)], ['cash', [20, 4, 12, 0]], 'Grab beats Block: cash 6 + 2')
  r = reveal(board(), B('F'), B('B'))
  eq([r.ev.result, r.ev.by, after(r)], ['clear', 0, [20, 0, 20, 6]], 'Focus beats Block: A clears; the blocker loses nothing')
  r = reveal(board(), B('B'), B('S'))
  eq([r.ev.result, r.ev.by, after(r)], ['turnback', 0, [20, 4, 20, 9]], 'Block beats Strike from the other seat too')
  r = reveal(board(0, 0), B('G'), B('B'))
  eq([r.ev.result, r.ev.cashed[1], after(r)], ['cash', 0, [20, 0, 18, 0]], 'A cash on an empty pile still chips')
}

// ---- mirrors ----
{
  let r = reveal(board(), B('S'), B('S'))
  eq([r.ev.kind, r.ev.result, after(r)], ['mirror', 'cancel', [20, 4, 20, 6]], 'Mirror (as written): two Strikes cancel')
  eq([r.G.A.cd1, r.G.B.cd1], [1 << B('S'), 1 << B('S')], 'Both mirrored cards go on cooldown')
  r = reveal(board(), B('F'), B('F'))
  eq([r.ev.result, after(r)], ['cancel', [20, 4, 20, 6]], 'Two Focuses cancel: neither clears')
  r = reveal(board(4, 6, { mirrors: 'all' }), B('S'), B('S'))
  eq([r.ev.result, after(r)], ['trade', [19, 7, 19, 9]], 'Mirrors take effect: two Strikes both build and chip')
  r = reveal(board(4, 6, { mirrors: 'all' }), B('H'), B('H'))
  eq([r.ev.result, after(r)], ['trade', [14, 0, 12, 0]], 'Mirrors take effect: two Heavies both cash')
  r = reveal(board(4, 6, { mirrors: 'all' }), B('B'), B('B'))
  eq([r.ev.result, after(r)], ['trade', [20, 4, 20, 6]], 'Mirrors take effect: two Blocks still do nothing')
  r = reveal(board(4, 6, { mirrors: 'focus' }), B('F'), B('F'))
  eq([r.ev.result, after(r)], ['trade', [20, 0, 20, 0]], 'Focus mirrors only: two Focuses both clear')
  r = reveal(board(4, 6, { mirrors: 'focus' }), B('G'), B('G'))
  eq(r.ev.result, 'cancel', 'Focus mirrors only: two Grabs still cancel')
  // piles of 20 against 20 HP: each Grab cashes 20 + 2
  r = reveal(board(20, 20, { mirrors: 'all' }), B('G'), B('G'))
  eq([r.ev.doubleKO, r.G.A.hp, r.G.B.hp, r.G.result], [true, -2, -2, 0.5], 'Double KO, level below 0: a draw')
  r = reveal(board(20, 10, { mirrors: 'all' }), B('G'), B('G'))
  eq([r.ev.doubleKO, r.G.A.hp, r.G.B.hp, r.G.result], [undefined, -2, 8, 0], 'One KO in a trade: the other player wins')
  r = reveal(board(21, 20, { mirrors: 'all' }), B('G'), B('G'))
  eq([r.G.A.hp, r.G.B.hp, r.G.result], [-3, -2, 0], 'Double KO: whoever ends least below 0 wins')
}

// ---- other wheels and the blocked-Heavy experiment ----
{
  let r = reveal(board(4, 6, { wheel: 'first' }), B('F'), B('B'))
  eq([r.ev.result, r.ev.by, after(r)], ['double', 1, [20, 8, 20, 6]], 'First-draft wheel: a blocked Focus doubles its pile')
  r = reveal(board(4, 6, { wheel: 'first' }), B('H'), B('B'))
  eq([r.ev.result, r.ev.by], ['cash', 0], 'First-draft wheel: Heavy beats Block')
  r = reveal(board(4, 6, { wheel: 'alt' }), B('F'), B('B'))
  eq([r.ev.result, after(r)], ['fizzle', [20, 4, 20, 6]], 'Alternative wheel: a blocked Focus fizzles')
  r = reveal(board(4, 6, { wheel: 'alt' }), B('G'), B('H'))
  eq([r.ev.result, r.ev.by], ['cash', 0], 'Alternative wheel: Grab beats Heavy')
  r = reveal(board(4, 6, { blockedHeavyGrey: 2 }), B('H'), B('B'))
  eq([r.ev.result, after(r)], ['stopped', [20, 6, 20, 6]], 'Experiment: a blocked Heavy puts 2 grey on its owner')
}

// ---- cooldown ----
{
  const G0 = newGame(vex, atlas)
  const grip = idx(atlas, 'G'), smash = idx(atlas, 'H'), flick = idx(vex, 'S'), poise = idx(vex, 'F')
  let r = reveal(G0, flick, grip)
  eq([r.G.A.cd1, r.G.A.cd2, r.G.B.cd1, r.G.B.cd2], [1 << flick, 0, 0, 1 << grip], 'Flick Cut (CD 1) on space 1; Titan Grip (CD 2) on space 2')
  eq([options(r.G, 0).includes(flick), options(r.G, 1).includes(grip)], [false, false], 'Neither can be played next reveal')
  eq([missingTypes(r.G.A), missingTypes(r.G.B)], [['S'], ['G']], 'Missing types: Vex Strike, Atlas Grab')
  r = reveal(r.G, poise, smash)
  eq([options(r.G, 0).includes(flick), options(r.G, 1).includes(grip), options(r.G, 1).includes(smash)], [true, false, false], 'A reveal later: Flick Cut is back; Titan Grip still out, now with Overhead Smash')
  eq(missingTypes(r.G.B), ['H', 'G'], 'Atlas is missing Heavy and Grab together')
  eq(options(r.G, 1).length, 3, 'Atlas has three cards that reveal')
  const r2 = reveal(r.G, flick, idx(atlas, 'S'))
  eq(options(r2.G, 1).includes(grip), true, 'Titan Grip is back two reveals after it was played')
  throws(() => reveal(r.G, flick, grip), 'Playing a card on cooldown is refused')
}

// ---- KO, the reveal limit, routes ----
{
  let r = reveal(board(0, 17), B('G'), B('B'))
  eq([r.G.over, r.G.B.hp], [false, 1], 'Not lethal: pile 17 + chip 2 leaves B on 1 HP')
  const G = board(0, 18)
  r = reveal(G, B('G'), B('B'))
  eq([r.G.over, r.G.result, r.G.B.hp], [true, 1, 0], 'Lethal: pile 18 + chip 2 = 20 HP, KO')
  eq(winRoute({ kind: 'win', by: 0, types: ['G', 'B'] }, 1), 'Grab', 'Route: a Grab KO')
  const L = newGame(ben, ben, { maxReveals: 1 })
  r = reveal(L, B('B'), B('B'))
  eq([r.G.over, r.G.result, r.ev.limit], [true, 0.5, true], 'Reveal limit: a draw')
}

// ---- validation ----
{
  const bad = JSON.parse(JSON.stringify(VEX))
  bad.cards[3].chip = 1                               // chip on a Focus
  bad.cards[1].grey = 2                               // grey on a Heavy
  const v = validateFighter(bad)
  eq(v.errors.length, 2, 'Chip on a Focus and grey on a Heavy are errors')
  const two = JSON.parse(JSON.stringify(VEX))
  two.cards.push({ name: 'Second Cut', type: 'strike', grey: 2, chip: 1 })
  eq([validateFighter(two).errors.length, validateFighter(two).warnings.length], [0, 1], 'A second Strike is allowed, with a guideline warning')
  const tiny = { ...JSON.parse(JSON.stringify(VEX)), cards: VEX.cards.slice(0, 2) }
  eq(validateFighter(tiny).errors.some(e => /At least 3/.test(e.msg)), true, 'Fewer than 3 cards is an error')
  eq(cardText(VEX.cards[4]), ["Wins: turns a Strike's grey back on its owner; stops a Heavy.", 'Beats Strike and Heavy.'], 'Block card text')
  eq(cardText(VEX.cards[0]), ['Wins: 1 grey on their pile, then 2 chip.', 'Beats Heavy and Grab.'], 'Strike card text')
}

// ---- the sparring partner ----
{
  const mx = mixes(newGame(ben, ben), newContext())
  eq([mx.oa.length, mx.ob.length, Math.abs(mx.x.reduce((a, b) => a + b, 0) - 1) < 1e-9], [5, 5, true], 'Opening grid is 5x5 with a proper mix')
  eq(Math.abs(mx.vA - 0.5) < 1e-6, true, 'A mirror match opens at an even value')
  const g = playAIGame(vex, atlas, mulberry32(3))
  eq([g.reveals.length > 3, [0, 0.5, 1].includes(g.result)], [true, true], 'A whole game plays out')
}

console.log(`${checks - fails} / ${checks} checks passed`)
process.exit(fails ? 1 : 0)
