// Rules v16 simulator (rules-overview 16.md): decks, the neutral phase, combos
// and statuses, with the v16 sparring partner.
//
//   node tools/sim16.mjs game benchmark benchmark -n 200 --seed 5   # one matchup, full report
//   node tools/sim16.mjs exploit benchmark -n 200                    # mindless bots vs Hard in the mirror
//   node tools/sim16.mjs game benchmark benchmark --levels hard,easy
//
// Fighters are file names in data/v16 (or a path to a .json file).
// --tie lowhp: a speed tie goes to the player on less HP. --json: JSON on the last line.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { playGame16, summarise16, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const flag = name => { const i = args.indexOf(name); if (i >= 0) { args.splice(i, 1); return true } return false }
const n = +opt('-n', 100), seed = +opt('--seed', 5), tie = opt('--tie', 'cancel'), levels = opt('--levels', 'hard,hard').split(',')
const json = flag('--json')
const settings = JSON.parse(fs.readFileSync(`${root}/data/v16/settings.json`, 'utf8'))
const rules = { ...settings.rules, ...(tie !== 'cancel' ? { speedTie: tie } : {}) }
const setFile = opt('--settings', null)              // e.g. v17/settings.json
if (setFile) Object.assign(rules, JSON.parse(fs.readFileSync(`${root}/data/${setFile}`, 'utf8')).rules)
// (the settings file first, so flags like --confiscateFloor override it)
for (const k of ['openingHand', 'handLimit', 'meterMax', 'burnMax', 'superUses', 'maxRounds', 'oneReveal', 'neutralMeter', 'burnNeutrals', 'focusMeter', 'greyPerRound', 'confiscateFloor', 'lateGrey', 'guardHalf', 'initiative', 'tableCards', 'refillAtReveal']) { const v = opt('--' + k, null); if (v !== null) rules[k] = +v }
const ban = opt('--ban', null)                      // side 0 won't play this neutral card (barred-card tests)
const W = { ...DEFAULT_W16, ...settings.ai }
for (const k of Object.keys(DEFAULT_W16)) { const v = opt('--' + k, null); if (v !== null) W[k] = +v }
if (ban) { W.ban = ban; W.banSide = 0 }
const mode = args[0]

function load(name) {
  const p = name.endsWith('.json') ? name : `${root}/data/v16/${name}.json`
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  const v = validateFighter16(f)
  if (v.errors.length) { console.error(name, v.errors); process.exit(1) }
  return toFighter16(f)
}

function run(a, b, lv, sd = seed) {
  const fa = load(a), fb = load(b)
  const rng = mulberry(sd * 7919 + 13)
  const games = []
  for (let i = 0; i < n; i++) games.push(playGame16(fa, fb, { rules, W, levels: lv, seed: sd * 100003 + i, rng }))
  return summarise16(games, [fa.name, fb.name])
}

const pct = x => (100 * x).toFixed(1) + '%'
const share = (o, tot) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / tot)}`).join(', ')

function report(r) {
  const R = r.totalRounds
  console.log(`win ${pct(r.win)} (±${(100 * r.margin).toFixed(1)})  median ${r.median} rounds (10–90%: ${r.p10.toFixed(0)}–${r.p90.toFixed(0)})  quiet ${pct(r.quiet / R)}`)
  console.log(`outcomes: ${share(r.outcomes, R)}`)
  console.log(`same-type duels ${pct(r.sameType / R)} of rounds, ${pct(r.ties / Math.max(r.sameType, 1))} tied and cancelled`)
  console.log(`how games end: ${share(r.routes, r.games)}`)
  for (const k of [0, 1]) {
    const T = Object.values(r.types[k]).reduce((s, v) => s + v, 0)
    console.log(`side ${k}: neutral ${share(r.neutral[k], R)}`)
    console.log(`        types ${share(r.types[k], T)} · Supers ${r.supers[k]} (${(r.supers[k] / r.games).toFixed(2)} a game) · burned ${(r.burned[k] / r.games).toFixed(1)} a game · reshuffles ${(r.reshuffles[k] / r.games).toFixed(2)} · hand after a round ${r.handAvg[k].toFixed(1)}`)
    console.log(`        plays ${share(r.plays[k], T)}`)
  }
  console.log(`Guard beats Pressure ${pct(r.guardWins / R)} of rounds: follow-up ${pct(r.follows / Math.max(r.guardWins, 1))} (${pct(r.followC / Math.max(r.follows, 1))} Converts, ${(r.followDmg / Math.max(r.follows, 1)).toFixed(1)} HP each), no Counter in hand ${pct(r.guardWinsNoCounter / Math.max(r.guardWins, 1))}`)
  console.log(`Starter wins ${pct(r.starterWins / R)} of rounds; combos ${pct(r.combos / R)} of rounds, ${(r.comboLen / Math.max(r.combos, 1)).toFixed(2)} cards, ${(r.comboDmg / Math.max(r.combos, 1)).toFixed(1)} HP each; ends: ${share(r.comboEnds, Math.max(r.combos, 1))}`)
  console.log(`statuses inflicted (per game): ${Object.entries(r.statuses).map(([k, v]) => `${k} ${(v / r.games).toFixed(2)}`).join(', ')}`)
  if (r.took) console.log(`taken from the table (a game): ${[0, 1].map(k => `side ${k}: ${share(Object.fromEntries(Object.entries(r.took[k]).map(([n, v]) => [n, v])), r.games).replace(/%/g, '').replace(/(\d+\.\d)/g, x => (x / 100).toFixed(2))}, fetched ${(r.fetched[k] / r.games).toFixed(2)}`).join(' · ')} · ties won by the initiative: ${r.tieByInit[0] + r.tieByInit[1]} (${pct((r.tieByInit[0] + r.tieByInit[1]) / R)} of rounds)`)
  for (const k of [0, 1]) {
    const dist = Object.entries(r.handClashDist[k]).sort((a, b) => a[0] - b[0]).map(([h, p]) => `${h}:${(100 * p).toFixed(0)}`).join(' ')
    console.log(`side ${k}: hand at the clash ${r.handClashAvg[k].toFixed(2)} [${dist}] · confiscated ${(r.conf[k] / r.games).toFixed(2)} a game (${(r.confPre[k] / r.games).toFixed(2)} before the clash): ${share(r.confCards[k], Math.max(r.conf[k], 1))} · in play after a round: ${share(r.inPlay[k], R)}`)
  }
}

const t0 = Date.now()
if (mode === 'game') {
  const r = run(args[1], args[2] || args[1], levels)
  if (json) console.log(JSON.stringify(r)); else report(r)
} else if (mode === 'exploit') {
  const name = args[1] || 'benchmark'
  const out = []
  for (const bot of ['pressure', 'attack', 'guard', 'random', 'easy', 'medium']) {
    const r = run(name, name, [bot, 'hard'])
    out.push({ bot, win: r.win, median: r.median })
    if (!json) console.log(`${bot.padEnd(9)} beats Hard ${pct(r.win)} (±${(100 * r.margin).toFixed(0)}), median ${r.median} rounds`)
  }
  if (json) console.log(JSON.stringify(out))
} else {
  console.log('usage: node tools/sim16.mjs game <a> [b] | exploit [fighter]  [-n games] [--seed s] [--levels hard,easy] [--tie lowhp] [--json]')
}
if (!json) console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
