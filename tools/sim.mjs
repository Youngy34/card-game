// Command-line balance runs on the JavaScript engine, reading the same JSON
// the app uses. The JS counterpart of yomi_sim.py.
//
//   node tools/sim.mjs gambler bastion            # 300 games
//   node tools/sim.mjs vex bastion -n 500 --seed 3
//   node tools/sim.mjs --all -n 500 --seed 5      # round-robin of data/fighters
//   node tools/sim.mjs gambler vex --counter attack
//   node tools/sim.mjs bastion-sc2 atlas           # an earlier version, from data/variants
//   node tools/sim.mjs path/to/variant.json atlas  # any fighter file
//   node tools/sim.mjs --list                      # every fighter and version by name

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toEngineFighter, validateFighter } from '../src/engine/fighters.js'
import { runBalance } from '../src/engine/game.js'
import { DEFAULT_WEIGHTS } from '../src/engine/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const n = +opt('-n', 300), seed = +opt('--seed', 0), counter = opt('--counter', 'always')
const levels = opt('--levels', 'hard,hard').split(',')     // e.g. --levels hard,easy
const json = args.includes('--json'); if (json) args.splice(args.indexOf('--json'), 1)
const all = args.includes('--all'); if (all) args.splice(args.indexOf('--all'), 1)
const list = args.includes('--list'); if (list) args.splice(args.indexOf('--list'), 1)
const settings = JSON.parse(fs.readFileSync(`${root}/data/settings.json`, 'utf8'))
const rules = { ...settings.rules, counterChip: counter }
const W = { ...DEFAULT_WEIGHTS, ...settings.ai }

function find(name) {
  if (name.endsWith('.json')) return name
  for (const dir of ['fighters', 'variants']) {
    const p = `${root}/data/${dir}/${name}.json`
    if (fs.existsSync(p)) return p
  }
  console.error(`No fighter called "${name}". Run with --list to see them.`); process.exit(1)
}

function load(name) {
  const p = find(name)
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  const v = validateFighter(f)
  if (v.errors.length) { console.error(`${name}:`, v.errors); process.exit(1) }
  return toEngineFighter(f)
}

const fmt = x => (100 * x).toFixed(1) + '%'
async function report(a, b) {
  const fa = load(a), fb = load(b)
  const r = await runBalance(fa, fb, { n, seed, rules, W, levels })
  if (json) { console.log(JSON.stringify({ a, b, levels, win: r.win, doubleKO: r.doubleKO / n, draws: r.draws / n, median: r.median })); return r }
  console.log(`\n=== ${fa.name} vs ${fb.name}  (${n} games, seed ${seed}${levels.join() !== 'hard,hard' ? `, levels ${levels.join(' v ')}` : ''}) ===`)
  console.log(`  ${fa.name} wins ${fmt(r.win)}  (about ±${Math.round(100 * r.margin)} points)`)
  console.log(`  game length: median ${r.median} rounds, mean ${r.mean.toFixed(1)}, 10th-90th percentile ${Math.round(r.p10)}-${Math.round(r.p90)}`)
  console.log(`  double KOs: ${fmt(r.doubleKO / n)} of games (${fmt(r.draws / n)} drawn)`)
  console.log(`  quiet rounds: ${fmt(r.quiet / r.totalRounds)}; Recover mirrors: ${fmt(r.recoverMirrors / r.totalRounds)}`)
  for (const k of [0, 1]) {
    const f = [fa, fb][k], S = r.sides[k], tot = Object.values(S.plays).reduce((x, y) => x + y, 0)
    console.log(`  ${f.name} type split: Pressure ${fmt(S.types.P / tot)}  Convert ${fmt(S.types.C / tot)}  Recover ${fmt(S.types.R / tot)}  Typeless ${fmt(S.types.T / tot)}`)
    for (const c of [...f.cards, f.sup]) {
      const p = S.plays[c.name] || 0
      console.log(`      ${c.name.padEnd(16)} ${fmt(p / tot).padStart(6)}   resolved ${fmt((S.resolved[c.name] || 0) / Math.max(p, 1)).padStart(6)}`)
    }
    const sr = S.superRounds.length ? S.superRounds.reduce((x, y) => x + y, 0) / S.superRounds.length : null
    console.log(`    Super used in ${fmt(1 - S.superUnused / n)} of games${sr ? `, mean round ${sr.toFixed(1)}` : ''}; locked out of a type in ${fmt(S.lockedOut / r.totalRounds)} of rounds`)
  }
  return r
}

if (list) {
  for (const dir of ['fighters', 'variants']) {
    console.log(dir === 'fighters' ? 'Signed off (used by --all):' : 'Earlier versions and variants:')
    for (const f of fs.readdirSync(`${root}/data/${dir}`).filter(f => f.endsWith('.json')).sort()) {
      const j = JSON.parse(fs.readFileSync(`${root}/data/${dir}/${f}`, 'utf8'))
      console.log(`  ${f.slice(0, -5).padEnd(18)} ${j.name}`)
    }
  }
} else if (all) {
  const names = fs.readdirSync(`${root}/data/fighters`).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
  for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) await report(names[i], names[j])
} else if (args.length === 2) {
  await report(args[0], args[1])
} else {
  console.log('usage: node tools/sim.mjs <a> <b> [-n games] [--seed s] [--counter strict|attack] [--levels hard,easy] | --all | --list')
}
