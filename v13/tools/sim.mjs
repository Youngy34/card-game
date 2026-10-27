// The rules v13 simulator: bulk sparring-partner games from the command line,
// on the same engine and fighter files as the app.
//
//   node v13/tools/sim.mjs vex atlas -n 200 --seed 1
//   node v13/tools/sim.mjs vex vex --levels hard,easy
//   node v13/tools/sim.mjs vex atlas --bonus 2 --cap 3 --first a
//   node v13/tools/sim.mjs vex atlas --json            (the full report as JSON)
//   Experiments: --clock 30, --guard-damage card (or --block-grey 2 for the same on every strike),
//   --throw-cashes, --evade-cooldown, --counter reveal, --wait-passes, --wrong-break-locks
//
// A fighter is an id from data/fighters/ or a path to a fighter JSON file.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toEngineFighter, validateFighter } from '../src/engine/fighters.js'
import { runBalance } from '../src/engine/game.js'
import { DEFAULT_RULES } from '../src/engine/rules.js'
import { DEFAULT_WEIGHTS } from '../src/engine/ai.js'
import { reportLines } from '../src/engine/report.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d }
const SWITCHES = ['--json', '--wait-passes', '--wrong-break-locks', '--throw-cashes', '--evade-cooldown']          // flags that take no value
const ids = args.filter((a, i) => !a.startsWith('-') && !(i > 0 && args[i - 1].startsWith('-') && !SWITCHES.includes(args[i - 1])))

function load(id) {
  const p = fs.existsSync(id) ? id : path.join(root, `data/fighters/${id}.json`)
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  const v = validateFighter(f)
  if (v.errors.length) { console.error(`${id}: ${v.errors.map(e => `${e.where}: ${e.msg}`).join('; ')}`); process.exit(1) }
  return toEngineFighter(f)
}

if (ids.length < 2) {
  console.log('Usage: node v13/tools/sim.mjs <fighter> <fighter> [-n 200] [--seed 1] [--levels hard,hard] [--bonus 3] [--cap 3] [--first random|a|b] [--json]')
  console.log('Fighters:', fs.readdirSync(path.join(root, 'data/fighters')).map(f => f.replace('.json', '')).join(', '))
  process.exit(0)
}
const settings = JSON.parse(fs.readFileSync(path.join(root, 'data/settings.json'), 'utf8'))
const rules = {
  ...DEFAULT_RULES, ...settings.rules,
  ...(flag('--bonus') ? { initiativeBonus: Number(flag('--bonus')) } : {}),
  ...(flag('--cap') ? { comboCap: Number(flag('--cap')) } : {}),
  ...(flag('--first') ? { firstInitiative: flag('--first') } : {}),
  // experiments
  ...(flag('--clock') ? { clock: Number(flag('--clock')) } : {}),
  ...(flag('--block-grey') ? { guardDamage: 'flat', blockGrey: Number(flag('--block-grey')) } : {}),
  ...(flag('--guard-damage') ? { guardDamage: flag('--guard-damage') } : {}),
  ...(args.includes('--throw-cashes') ? { throwCashes: true } : {}),
  ...(args.includes('--evade-cooldown') ? { evadeCooldown: true } : {}),
  ...(flag('--counter') ? { counterCheck: flag('--counter') } : {}),
  ...(args.includes('--wait-passes') ? { waitPasses: true } : {}),
  ...(args.includes('--wrong-break-locks') ? { wrongBreakLocks: true } : {}),
}
const W = { ...DEFAULT_WEIGHTS, ...settings.ai }
const n = Number(flag('-n', 200)), seed = Number(flag('--seed', 1))
const levels = (flag('--levels', 'hard,hard')).split(',')
const [fa, fb] = [load(ids[0]), load(ids[1])]
const t0 = Date.now()
const r = await runBalance(fa, fb, { n, seed, rules, W, levels })
const secs = (Date.now() - t0) / 1000
if (args.includes('--json')) {
  const { fighters, ...rest } = r
  console.log(JSON.stringify({ fighters: [fa.name, fb.name], rules, W, levels, seed, ...rest }, null, 1))
} else {
  console.log(`${fa.name} vs ${fb.name} · ${r.games} games · seed ${seed} · levels ${levels.join(' vs ')} · bonus +${rules.initiativeBonus}, cap ${rules.comboCap} · ${secs.toFixed(1)} s`)
  for (const line of reportLines(r)) console.log(line)
}
