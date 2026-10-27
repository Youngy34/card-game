// Hand-checked rules v13 situations, run against the engine.
//
//   node v13/tools/test-engine.mjs
//
// Each case is worked out from rules-overview 13.md and the Vex and Atlas drafts.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { newGame, reveal, options, counterOptions, avail, bits } from '../src/engine/engine.js'
import { toEngineFighter, validateFighter } from '../src/engine/fighters.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = id => JSON.parse(fs.readFileSync(path.join(root, `data/fighters/${id}.json`), 'utf8'))
const VEX = load('vex'), ATLAS = load('atlas')
const vex = toEngineFighter(VEX), atlas = toEngineFighter(ATLAS)
const idx = (f, name) => { const i = f.cards.findIndex(c => c.name === name); if (i < 0) throw new Error(name); return i }
const V = n => idx(vex, n), A = n => idx(atlas, n)

let checks = 0, fails = 0
const eq = (got, want, what) => {
  checks++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fails++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`) }
}
const names = (f, list) => list.map(i => (typeof i === 'number' ? f.cards[i].name : i))

// files validate
for (const f of [VEX, ATLAS]) eq(validateFighter(f).errors, [], `${f.name} validates`)

// Vex = A (side 0), Atlas = B (side 1)
const game = init => newGame(vex, atlas, {}, init)

// ---- neutral: attack against defence ----
{
  const G = game(0)
  let r = reveal(G, V('Needle'), 'G')
  eq([r.ev.result, r.ev.onBlock, r.G.init], ['blocked', 0, 0], 'Needle (=) guarded: blocked, initiative stays with Vex')
  r = reveal(game(1), V('Flick Cut'), 'G')
  eq([r.ev.result, r.G.init], ['blocked', 0], 'Flick Cut (+) guarded from minus: Vex takes the initiative')
  r = reveal(G, V('Twin Fang'), 'G')
  eq([r.ev.result, r.G.init], ['blocked', 1], 'Twin Fang (−) guarded: Atlas takes the initiative')
  r = reveal(G, V('Needle'), 'D')
  eq([r.ev.result, r.ev.dmg, r.G.mode, r.G.combo?.att], ['hit', [0, 1], 'combo', 0], 'Needle vs Duck: hit for 1, Vex starts a combo')
  r = reveal(G, V('Flick Cut'), 'S')
  eq([r.ev.result, r.G.mode], ['hit', 'combo'], 'Horizontal vs Step: hit')
  r = reveal(G, V('Hilt Hook'), 'G')
  eq([r.ev.result, r.ev.dmg, r.G.B.pile, r.G.init, r.G.mode], ['thrown', [0, 2], 1, 0, 'neutral'], 'Hilt Hook vs Guard: thrown, 2 damage and 1 grey, no combo')
  r = reveal(G, V('Hilt Hook'), 'S')
  eq([r.ev.result, r.G.init, r.ev.counter], ['evaded', 1, undefined], 'Throw vs Step: evaded, no counter, Atlas takes the initiative')
  r = reveal(G, 'S', 'D')
  eq([r.ev.result, r.G.init, r.G.n], ['none', 0, 2], 'Two defences: nothing happens')
}

// ---- exposed and counters ----
{
  const G = game(0)
  let r = reveal(G, V('Flick Cut'), 'D')
  eq(r.pending && names(atlas, r.pending.options), ['Pommel Jab', 'Wide Swing', 'Rising Haft', 'Titan Grip'],
    'Flick Cut (7) ducked: Atlas can counter with anything at Speed 4+ (4 + 3 = 7, holder wins ties)')
  r = reveal(G, V('Flick Cut'), 'D', A('Rising Haft'))
  eq([r.ev.result, r.ev.counter.result, r.ev.dmg, r.G.mode, r.G.combo.att, r.G.init], ['exposed', 'hit', [2, 0], 'combo', 1, 1],
    'Counter with Rising Haft: hit for 2, Atlas starts a combo')
  eq([bits(r.G.B.cd1)].map(m => names(atlas, m)), [['Rising Haft']], 'The counter goes on cooldown')
  r = reveal(G, V('Flick Cut'), 'D', A('Titan Grip'))
  eq([r.ev.counter.result, r.ev.dmg, r.G.A.pile, r.G.init, r.G.mode], ['thrown', [4, 0], 3, 1, 'neutral'], 'Counter with Titan Grip: thrown')
  r = reveal(G, V('Flick Cut'), 'D', null)
  eq([r.ev.counter.card, r.G.init, r.G.mode], [null, 1, 'neutral'], 'No counter: Atlas just keeps the initiative')
  r = reveal(game(1), 'S', A('Overhead Smash'))
  eq(r.pending && names(vex, r.pending.options), ['Needle', 'Flick Cut', 'Twin Fang', 'Lunge', 'Crescent', 'Eviscerate', 'Hilt Hook'],
    'Overhead Smash (3) stepped: anything of Vex counters it')
  r = reveal(game(0), 'D', A('Pommel Jab'))
  // Atlas's Pommel Jab (7) ducked by Vex: Vex (now holder) needs 4+
  eq(names(vex, r.pending.options), ['Needle', 'Flick Cut', 'Twin Fang', 'Lunge', 'Crescent', 'Eviscerate', 'Hilt Hook'], 'Pommel Jab ducked: Vex needs Speed 4+')
}

// ---- clashes ----
{
  let r = reveal(game(0), V('Eviscerate'), A('Pommel Jab'))
  eq([r.ev.kind, r.ev.speeds, r.ev.by, r.ev.result], ['clash', [7, 7], 0, 'hit'], 'Vex holds: Eviscerate 4 + 3 ties Pommel Jab 7, holder wins')
  r = reveal(game(1), V('Needle'), A('Rising Haft'))
  eq([r.ev.speeds, r.ev.by], [[8, 8], 1], 'Atlas holds: Rising Haft 5 + 3 ties Needle 8, Atlas wins')
  r = reveal(game(1), V('Needle'), A('Overhead Smash'))
  eq([r.ev.speeds, r.ev.by], [[8, 6], 0], 'Needle interrupts Overhead Smash even on Atlas\'s turn')
  r = reveal(game(1), V('Hilt Hook'), A('Titan Grip'))
  eq([r.ev.speeds, r.ev.by, r.ev.result, r.G.init], [[6, 7], 1, 'thrown', 1], 'Throw clash: Titan Grip 4 + 3 beats Hilt Hook 6')
}

// ---- combos ----
{
  // Atlas lands Rising Haft as a counter, then: Wide Swing vs Break Heavy (lands),
  // Overhead Smash vs hold (lands), Crater (cash 8, keeps the initiative)
  let G = reveal(game(0), V('Flick Cut'), 'D', A('Rising Haft')).G
  eq(names(atlas, options(G, 1)), ['Pommel Jab', 'Wide Swing', 'Overhead Smash', 'G'], 'Beat 1: linkers and a feint; no ender before a linker lands')
  eq(options(G, 0), ['BL', 'BM', 'BH', 'G'], 'Defender: three Breaks and the hold')
  let r = reveal(G, 'BH', A('Wide Swing'))
  eq([r.ev.result, r.ev.wrongBreak, r.G.A.pile, r.G.mode], ['lands', 'BH', 3, 'combo'], 'Wide Swing vs Break Heavy: lands, 3 grey')
  G = r.G
  r = reveal(G, 'G', A('Overhead Smash'))
  eq([r.ev.result, r.G.A.pile], ['lands', 8], 'Overhead Smash vs hold: pile 8')
  G = r.G
  eq(names(atlas, options(G, 1)).includes('Crater'), true, 'An ender is allowed once a linker has landed')
  r = reveal(G, 'BL', A('Crater'))
  eq([r.ev.result, r.ev.cashed, r.G.A.hp, r.G.A.pile, r.G.init, r.G.mode], ['cashed', 8, 30 - 2 - 8, 0, 1, 'neutral'],
    'Crater cashes 8, the pile clears, Atlas keeps the initiative')
  eq([r.G.A.brk], [0], 'A Break played against an ender does nothing')
}
{
  let G = reveal(game(0), V('Flick Cut'), 'D', A('Rising Haft')).G
  let r = reveal(G, 'G', A('Pommel Jab'))
  G = r.G
  r = reveal(G, 'BL', A('Wide Swing'))                                  // wrong guess: lands
  r = reveal(G, 'BM', A('Wide Swing'))
  eq([r.ev.result, r.ev.cleared, r.G.A.pile, r.G.init, r.G.mode], ['broken', 2, 0, 0, 'neutral'],
    'Break Medium reads Wide Swing: the whole pile clears, Vex takes the initiative')
}
{
  let G = reveal(game(0), V('Flick Cut'), 'D', A('Rising Haft')).G
  let r = reveal(G, 'BH', 'G')
  eq([r.ev.result, r.G.A.brk, options(r.G, 0)], ['locked', 4, ['BL', 'BM', 'G']], 'Feint vs Break Heavy: it is locked for the next beat')
  G = r.G
  r = reveal(G, 'G', 'G')
  eq([r.ev.result, r.G.mode, r.G.init], ['dropped', 'neutral', 0], 'Feint vs hold: dropped, Vex takes the initiative')
}
{
  // the cap: after three feints there is no linker landed, so no ender: blowout
  let G = reveal(game(0), V('Flick Cut'), 'D', A('Rising Haft')).G
  G = reveal(G, 'BH', 'G').G
  G = reveal(G, 'BM', 'G').G
  const r = reveal(G, 'BL', 'G')
  eq([r.ev.result, r.ev.blowout, r.G.mode, r.G.init], ['locked', true, 'neutral', 0], 'Three feints and no linker landed: the combo blows out')
}
{
  // after three linkers and feints, only enders
  let G = reveal(game(0), V('Flick Cut'), 'D', A('Rising Haft')).G
  G = reveal(G, 'G', A('Pommel Jab')).G
  G = reveal(G, 'G', A('Wide Swing')).G
  G = reveal(G, 'BH', 'G').G
  eq(names(atlas, options(G, 1)), ['Home Run', 'Crater'], 'At the cap: only enders')
}

// ---- cooldown ----
{
  let G = game(0)
  G = reveal(G, 'G', A('Titan Grip')).G                                 // Titan Grip: Cooldown 2
  eq([bits(G.B.cd2), bits(avail(G.B)).includes(A('Titan Grip'))], [[A('Titan Grip')], false], 'Cooldown 2 card on space 2')
  G = reveal(G, 'S', 'S').G
  eq(bits(avail(G.B)).includes(A('Titan Grip')), false, 'Still out the next reveal')
  G = reveal(G, 'S', 'S').G
  eq(bits(avail(G.B)).includes(A('Titan Grip')), true, 'Back after two reveals')
  G = reveal(game(0), V('Needle'), 'G').G
  eq(bits(avail(G.A)).includes(V('Needle')), false, 'Cooldown 1 card sits out the next reveal')
  G = reveal(G, 'S', 'S').G
  eq(bits(avail(G.A)).includes(V('Needle')), true, 'and comes back after it')
}

// ---- KO ----
{
  let G = game(0)
  G = { ...G, B: { ...G.B, hp: 2 } }
  const r = reveal(G, V('Hilt Hook'), 'G')
  eq([r.G.over, r.G.result, r.ev.ko], [true, 1, true], 'A throw that takes Atlas to 0 ends the game')
}

// ---- experiments: grey in neutral, evade cooldown ----
{
  const gd = rules => newGame(vex, atlas, rules, 0)
  let r = reveal(gd({ guardDamage: 'card' }), 'G', A('Overhead Smash'))
  eq([r.ev.result, r.G.A.pile, r.ev.grey], ['blocked', 3, [3, 0]], 'Guard damage per card: blocking Overhead Smash puts its 3 Block grey on Vex')
  r = reveal(gd({ guardDamage: 'flat', blockGrey: 2 }), 'G', A('Overhead Smash'))
  eq(r.G.A.pile, 2, 'Guard damage flat: 2 grey whatever the card')
  r = reveal(gd({}), 'G', A('Overhead Smash'))
  eq(r.G.A.pile, 0, 'Guard damage off by default')
  let G = gd({ throwCashes: true })
  G = { ...G, A: { ...G.A, pile: 6 } }
  r = reveal(G, 'G', A('Titan Grip'))
  eq([r.ev.throwCash, r.ev.dmg[0], r.G.A.hp, r.G.A.pile], [6, 10, 20, 3], 'A throw cashes the pile (6) on top of its Hit (4), then adds its own grey (3)')
  r = reveal({ ...G, R: { ...G.R, throwCashes: false } }, 'G', A('Titan Grip'))
  eq([r.G.A.hp, r.G.A.pile], [26, 9], 'Without the switch the pile stays and grows')
  G = gd({ evadeCooldown: true })
  r = reveal(G, 'D', 'S')
  eq([options(r.G, 0).slice(-2), options(r.G, 1).slice(-2)], [['G', 'S'], ['G', 'D']], 'After Duck and Step, each is out for the next reveal')
  r = reveal(r.G, 'G', 'G')
  eq([options(r.G, 0).slice(-3), options(r.G, 1).slice(-3)], [['G', 'D', 'S'], ['G', 'D', 'S']], 'and back after it; Guard never cools down')
}

console.log(`${checks - fails} / ${checks} checks passed`)
if (fails) process.exit(1)
