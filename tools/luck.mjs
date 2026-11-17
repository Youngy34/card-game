// Luck plan, Phase 0 (claude/luck plan (v22 direction).md): how much of a result is luck.
//
//   node tools/luck.mjs game <a> <b> -n 300 --seed 5     # Hard v Hard: decisive clashes, decision gap
//   node tools/luck.mjs bots <fighter> -n 200            # mindless bots against Hard and the Learner
//   node tools/luck.mjs learner <a> <b> -n 200           # the Learner (side 0) against Hard
//
// --edition v21 (default), --set k=v, --hp a,b, --json, as in sim18. --cap -2 / --hpplus 4: every
// fighter's cap and HP moved (Phase 1). --never-buy: the bots never shop
// (as in the v21 doc's figures); otherwise they shop as the engine's bots do (random: at random).
//
// Decisive-clash share: games where one round dealt 40%+ of the damage the loser took.
// Decision gap: on each Hard decision, how much its best card beats the average card it could
// play (win chance, by its own value function); random play gives up about this much a round.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16, validateFighter16 } from '../src/engine/v16/cards.js'
import { playGame18, mulberry } from '../src/engine/v16/game.js'
import { aiClash, payConfiscates } from '../src/engine/v16/game.js'
import { chooseRead18, chooseDiscards, bestChoice16, value16, features16, FIT_KEYS } from '../src/engine/v16/ai.js'
import { DEFAULT_W16, clashMix16, exploitMix16, sampleIndex, botClash, stanceMix16, chooseBuy20, botBuy20 } from '../src/engine/v16/ai.js'
import { heatOf, capOf, card16, buyOptions20, buy20, runClash16, startDraw16, discardDown16, initOrder } from '../src/engine/v16/engine.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const opts = name => { const out = []; let i; while ((i = args.indexOf(name)) >= 0) out.push(args.splice(i, 2)[1]); return out }
const flag = name => { const i = args.indexOf(name); if (i >= 0) { args.splice(i, 1); return true } return false }
const n = +opt('-n', 300), seed = +opt('--seed', 5), edition = opt('--edition', 'v21'), hpSet = opt('--hp', null)
const botList = opt('--bots', 'random,pressure,guard').split(','), hardOnly = flag('--hard-only')
const RB = +opt('--reader-beta', 0.5)
const fitFile = opt('--fit', null)                        // weights from tools/fit.py, for the fitted partner
const FIT = fitFile ? JSON.parse(fs.readFileSync(fitFile, 'utf8')) : null
const rangeAuto = flag('--range-auto'), rangeW = +opt('--range-w', 3)
const capD = +opt('--cap', 0), hpD = +opt('--hpplus', 0)
const breakChip = opt('--breakchip', null)   // Phase 2: '-1' lowers every Break's chip (min 1); '=1' sets it (the Super untouched)   // Phase 1: every fighter's cap and HP moved by these
const json = flag('--json'), sets = opts('--set'), botsNeverBuy = flag('--never-buy')
const settings = JSON.parse(fs.readFileSync(`${root}/data/${edition}/settings.json`, 'utf8'))
const rules = { ...settings.rules }
const parse = v => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v)
for (const s of sets) { const [k, v] = s.split('='); rules[k] = parse(v) }
const W = { ...DEFAULT_W16, ...settings.ai }
// Range test (13 Nov): the range-blind partner is the fitted one with the range features dropped; 'thumb' is blind in
// the clash but flips by rule of thumb (the away side when away from its range, home when home). --explore p: when
// recording, each end-of-round choice is random with chance p, so flips and odd positions show up in the data.
const RANGE_KEYS = ['home', 'dead', 'movers', 'sideFit']
const blindW = Wx => (Wx.fit ? { ...Wx, fit: Object.fromEntries(Object.entries(Wx.fit).filter(([k]) => !RANGE_KEYS.includes(k))) } : Wx)
const explore = +opt('--explore', 0)
// --blind k1,k2: kinds 'kb0' / 'kb1' play a partner whose value ignores those features (what that knowledge is worth)
const blindKeys = (opt('--blind', '') || '').split(',').filter(Boolean)
const dropKeys = Wx => (Wx.fit ? { ...Wx, fit: Object.fromEntries(Object.entries(Wx.fit).filter(([k]) => !blindKeys.includes(k))) } : Wx)
const sideFits = (G, X) => (X.side === 'away') === (G.range !== X.f.prefers)
function thumbBuy(G, k, rng) {
  const X = k === 0 ? G.A : G.B
  if (!sideFits(G, X)) return 'F'
  const o = chooseBuy20({ ...G, rules: { ...G.rules, sides: false } }, k, blindW(W), rng)
  return o
}
const exploreBuy = Wx => (G, k, rng) => { const o = buyOptions20(G, k); return rng() < explore ? o[Math.floor(rng() * o.length)] : chooseBuy20(G, k, Wx, rng) }

function load(name, side) {
  const p = name.endsWith('.json') ? path.resolve(root, name) : `${root}/data/${edition}/${name}.json`
  const f = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (hpSet) f.hp = +hpSet.split(',')[side]
  if (capD) f.greyCap = Math.max(1, (f.greyCap || rules.greyCap) + capD)
  if (hpD) f.hp += hpD
  // Range prototype (12 Nov): reach and movement assigned by kind of card (a stand-in until cards are designed)
  if (rangeAuto) for (const c of [...f.cards, ...(f.super ? [f.super] : [])]) {
    if (c.reach) continue
    const icons = c.icons || [], chain = /Haul|Chain|Coil|Shakedown|Shackles/.test(c.name)
    if (c.type === 'recover') c.reach = 'both'
    else if (c.kind === 'grab') { c.reach = chain ? 'both' : 'close'; if (chain) c.move = 'pull' }
    else if (c.kind === 'guardBreak' || c.kind === 'heavy') { if (icons.includes('starter')) { c.reach = 'both'; c.move = 'pull' } else { c.reach = 'close'; c.move = 'push' } }
    else if (c.kind === 'projectile') c.reach = 'far'
    else if ((c.speed || 0) >= 15) c.reach = 'close'
    else { c.reach = 'both'; c.move = 'push' }
  }
  if (breakChip) for (const c of f.cards) if (c.type === 'convert') c.chip = breakChip.startsWith('=') ? +breakChip.slice(1) : Math.max(1, (c.chip || 0) + +breakChip)
  const v = validateFighter16(f)
  if (v.errors.length) { console.error(name, v.errors); process.exit(1) }
  return toFighter16(f)
}

// ---- pickers ------------------------------------------------------------------------
const stateOf = (G, k) => {
  const me = heatOf(G, k), them = heatOf(G, 1 - k)
  const myCap = capOf(k === 0 ? G.B : G.A, G.rules), theirCap = capOf(k === 0 ? G.A : G.B, G.rules)
  if (me >= myCap) return 'you full'
  if (them >= theirCap) return 'them full'
  if (me <= 1 && them <= 1) return 'both empty'
  return 'between'
}
// Hard, as aiClash plays it (same draws on the rng), noting the decision gap
const bucket = (v, cap) => (v <= 0 ? '0' : v >= cap ? 'full' : v <= 2 ? '1-2' : '3+')
function hardPicker(gaps, mix) {
  return (G, k, rng) => {
    const m = clashMix16(G, k, W, rng, 'hard')
    if (m.util?.length > 1) {
      const best = Math.max(...m.util), mean = m.util.reduce((a, v) => a + v, 0) / m.util.length
      const st = stateOf(G, k); (gaps[st] ||= []).push(best - mean); (gaps.all ||= []).push(best - mean)
      if (mix) {
        const X = k === 0 ? G.A : G.B
        const key = `${bucket(heatOf(G, k), capOf(k === 0 ? G.B : G.A, G.rules))}|${bucket(heatOf(G, 1 - k), capOf(X, G.rules))}`
        const e = (mix[key] ||= { n: 0, P: 0, C: 0, R: 0, gap: 0, held: { P: 0, C: 0, R: 0 } })
        e.n++; e.gap += best - mean
        m.options.forEach((o, i) => { const t = o === null ? null : card16(X, o)?.t; if (t) e[t] += m.x[i] })
        const seen = new Set(m.options.map(o => (o === null ? null : card16(X, o)?.t)))
        for (const t of ['P', 'C', 'R']) if (seen.has(t)) e.held[t]++
      }
    }
    return m.options[sampleIndex(m.x, rng)]
  }
}
// The Learner: Hard's solve, then the best reply to a blend of it and the opponent's habits
function learner() {
  const L = { freq: { P: 0, C: 0, R: 0 }, seen: 0 }
  const pick = (G, k, rng) => {
    const beta = Math.min(0.8, L.seen / (L.seen + 4))
    const m = exploitMix16(G, k, W, rng, L.freq, beta)
    return m.options[sampleIndex(m.x, rng)]
  }
  const watch = side => rec => {
    const t = rec.types?.[1 - side]
    for (const key of ['P', 'C', 'R']) L.freq[key] *= 0.85
    if (t && L.freq[t] !== undefined) { L.freq[t] += 1; L.seen++ }
  }
  return { pick, watch }
}

// Decomposing random play: 'rtype' picks a type at random, then Hard's best card of it;
// 'rcard' picks the type Hard's mix would, then a random card of that type
function splitPicker(which) {
  return (G, k, rng) => {
    const m = clashMix16(G, k, W, rng, 'hard'), X = k === 0 ? G.A : G.B
    const ty = m.options.map(o => (o === null ? null : card16(X, o)?.t))
    const types = [...new Set(ty.filter(Boolean))]
    if (!types.length) return m.options[0]
    let t
    if (which === 'rtype') t = types[Math.floor(rng() * types.length)]
    else t = ty[sampleIndex(m.x, rng)] || types[0]
    const idx = ty.map((v, i) => (v === t ? i : -1)).filter(i => i >= 0)
    if (which === 'rtype') return m.options[idx.reduce((a, i) => (m.util[i] > m.util[a] ? i : a), idx[0])]
    return m.options[idx[Math.floor(rng() * idx.length)]]
  }
}

// Stance tests (--set stance=true): 'honest' plays Hard's stance and never feints (Hard's mix, cut to the
// stance's type); 'rhonest' picks a random stance and then the best card of that type
function honestPicker(G, k, rng) {
  const m = clashMix16(G, k, W, rng, 'hard'), X = k === 0 ? G.A : G.B
  const idx = m.options.map((o, i) => i).filter(i => m.options[i] !== null && card16(X, m.options[i])?.t === G.stance?.[k])
  if (!idx.length) return m.options[sampleIndex(m.x, rng)]
  const tot = idx.reduce((a, i) => a + m.x[i], 0)
  if (tot <= 1e-9) return m.options[idx.reduce((a, i) => (m.util[i] > m.util[a] ? i : a), idx[0])]
  let r = rng() * tot
  for (const i of idx) { r -= m.x[i]; if (r <= 0) return m.options[i] }
  return m.options[idx.at(-1)]
}
function rhonestPicker(G, k, rng) {
  const m = clashMix16(G, k, W, rng, 'hard'), X = k === 0 ? G.A : G.B
  const idx = m.options.map((o, i) => i).filter(i => m.options[i] !== null && card16(X, m.options[i])?.t === G.stance?.[k])
  const pool = idx.length ? idx : m.options.map((o, i) => i)
  return m.options[pool.reduce((a, i) => (m.util[i] > m.util[a] ? i : a), pool[0])]
}
const randomStance = (G, k, rng) => ['P', 'C', 'R'][Math.floor(rng() * 3)]

// Hand-management test: 'sloppy' clashes as Hard but manages its hand at random (riders, shop and trades,
// combos and follow-ups, discards). Habits: 'habit' plays Hard's mix bent by human-like habits (Guard more when
// its hand is low, Break more when Fully Charged, Pressure more after losing a clash). 'reader' is Hard bent
// towards the opponent's habits in each situation (the same three cues), learned over the game.
const aiClash18 = (G, k, rng) => aiClash(G, k, 'hard', W, rng)
const randomCombo = (g, p, rng) => { const o = [...p.options, null]; return o[Math.floor(rng() * o.length)] }
const randomDiscards = (X, n, rng) => { const h = X.hand.slice(), out = []; for (let k = 0; k < n && h.length; k++) out.push(h.splice(Math.floor(rng() * h.length), 1)[0]); return out }
const cueOf = (G, k, lost) => {
  const X = k === 0 ? G.A : G.B
  return `${X.hand.length <= 4 ? 'L' : 'h'}${heatOf(G, k) >= capOf(k === 0 ? G.B : G.A, G.rules) ? 'F' : 'f'}${lost[k] ? 'X' : 'w'}`
}
function habitSet() {
  const lost = [false, false]
  const pick = (G, k, rng) => {
    const m = clashMix16(G, k, W, rng, 'hard'), X = k === 0 ? G.A : G.B, c = cueOf(G, k, lost)
    const bend = { P: c[2] === 'X' ? 2.5 : 1, C: c[1] === 'F' ? 2.5 : 1, R: c[0] === 'L' ? 2.5 : 1 }
    const x = m.options.map((o, i) => m.x[i] * (o === null ? 1 : bend[card16(X, o)?.t] || 1))
    const s = x.reduce((a, v) => a + v, 0)
    return m.options[sampleIndex(x.map(v => v / s), rng)]
  }
  const watch = rec => { for (const k of [0, 1]) lost[k] = rec.winner === 1 - k }
  return { pick, watch, lost }
}
function readerSet(lost) {
  const F = {}                          // cue -> { P, C, R, n }
  let lastCue = null
  const pick = (G, k, rng) => {
    const cue = cueOf(G, 1 - k, lost); lastCue = cue
    const f = F[cue] || { P: 0, C: 0, R: 0, n: 0 }
    const beta = Math.min(RB, f.n / (f.n + 8))
    const h = clashMix16(G, k, W, rng, 'hard')                       // Hard's own answer...
    if (beta <= 0) return h.options[sampleIndex(h.x, rng)]
    const e = exploitMix16(G, k, W, rng, f, 1)                       // ...and the best reply to their habits here
    const x = h.x.map((v, i) => (1 - beta) * v + beta * (e.x[i] ?? 0))
    return h.options[sampleIndex(x, rng)]
  }
  const watch = side => rec => {
    const t = rec.types?.[1 - side]
    if (!lastCue || !t) return
    const f = (F[lastCue] ||= { P: 0, C: 0, R: 0, n: 0 })
    for (const key of ['P', 'C', 'R']) f[key] *= 0.9
    f[t] += 1; f.n++
  }
  return { pick, watch }
}

// The deeper planner (12 Nov): Hard in the clash, but at the end of the round it scores each purchase (or trade) by
// rolling the game on one more round (both sides playing Hard on lighter solves, then shopping one round ahead and
// discarding down) and valuing the position at the start of the round after: two rounds ahead instead of one.
const DEEP_R = +(process.env.DEEP_R || 3)
let DEEP_W = null
function deepBuy(G, k, rng) {
  const opts = buyOptions20(G, k)
  if (opts.length < 2) return null
  const Wl = { ...(DEEP_W || W), samples: 2, mySamples: 1, buySamples: 2 }
  const val = g => (g.result !== null && g.result !== undefined ? (k === 0 ? g.result : 1 - g.result) : (k === 0 ? value16(g, Wl) : 1 - value16(g, Wl)))
  const finishEnd = g => {
    while (g.phase === 'buy') { const b = g.buying; g = buy20(g, b, chooseBuy20(g, b, Wl, rng)) }
    let guard = 0
    while (g.phase === 'draw' && guard++ < 4) for (const s of initOrder(g)) if (g.discardDown?.[s]) g = discardDown16(g, s, chooseDiscards(s === 0 ? g.A : g.B, g.discardDown[s]))
    return g
  }
  const scores = opts.map(o => {
    let tot = 0
    for (let r = 0; r < DEEP_R; r++) {
      let g = finishEnd(buy20(G, k, o))
      if (g.result !== null && g.result !== undefined) { tot += val(g); continue }
      const picks = [0, 1].map(s => { const m = clashMix16(g, s, Wl, rng, 'hard'); return m.options[sampleIndex(m.x, rng)] })
      const ro = [undefined, undefined]
      for (const s of initOrder(g)) ro[s] = chooseRead18(g, s, picks, ro, Wl)
      g = runClash16(g, picks[0], picks[1], (gg, p) => bestChoice16(gg, p, Wl), false, ro)
      g = payConfiscates(g, ['hard', 'hard'], [Wl, Wl], rng).G
      if (g.result !== null && g.result !== undefined) { tot += val(g); continue }
      g = finishEnd(startDraw16(g))
      tot += val(g)
    }
    return tot / DEEP_R
  })
  let best = 0
  scores.forEach((v, i) => { if (v > scores[best]) best = i })
  return opts[best]
}

// ---- one batch -------------------------------------------------------------------------
function run(a, b, kind, sd = seed) {
  const fa = load(a, 0), fb = load(b, 1)
  const rng = mulberry(sd * 7919 + 13)
  const gaps = {}, games = [], mix = {}, feints = { n: 0, f: 0 }, rows = []
  for (let i = 0; i < n; i++) {
    let pickers = [null, null], onRound = null, levels = ['hard', 'hard'], buyers = [null, null], stancers = [null, null], combos = [null, null], discarders = [null, null], Ws = [W, W]
    if (kind === 'hard') pickers = [hardPicker(gaps, mix), hardPicker(gaps, mix)]
    else if (kind.startsWith('learner')) {
      const Lr = learner(); pickers = [Lr.pick, null]; onRound = Lr.watch(0)
      const bot = kind.split(':')[1]
      if (bot) { levels = ['hard', bot]; pickers[1] = (G, k, r) => botClash(G, k, bot, r); if (botsNeverBuy) buyers[1] = () => null }
    } else if (kind === 'sloppy') { levels = ['random', 'hard']; pickers = [(G, k, r) => aiClash18(G, k, r), null]; combos = [randomCombo, null]; discarders = [randomDiscards, null]
    } else if (kind === 'habitHard' || kind === 'habitReader') {
      const H = habitSet(); pickers = [null, H.pick]
      if (kind === 'habitReader') { const R = readerSet(H.lost); pickers[0] = R.pick; const rw = R.watch(0); onRound = rec => { rw(rec); H.watch(rec) } }
      else onRound = H.watch
    } else if (kind === 'record') { onRound = (rec, G) => { if (G.result === null) rows.push([FIT_KEYS.map(k => features16(G, 0)[k] - features16(G, 1)[k]), i]) }
      if (explore) buyers = [exploreBuy(W), exploreBuy(W)]
    } else if (kind === 'blind0') { Ws = [blindW(W), W]
    } else if (kind === 'blind1') { Ws = [W, blindW(W)]
    } else if (kind === 'thumb0') { Ws = [blindW(W), W]; buyers = [thumbBuy, null]
    } else if (kind === 'thumb1') { Ws = [W, blindW(W)]; buyers = [null, thumbBuy]
    } else if (kind === 'blindthumb') { Ws = [blindW(W), blindW(W)]; buyers = [null, thumbBuy]
    } else if (kind === 'thumbblind') { Ws = [blindW(W), blindW(W)]; buyers = [thumbBuy, null]
    } else if (kind === 'blindmirror') { Ws = [blindW(W), blindW(W)]
    } else if (/^[rng]buy[01]$/.test(kind)) {
      // the shop test (13 Nov): one side shops at random ('r'), never shops ('n') or buys the first thing it can afford ('g')
      const s = +kind.at(-1), how = kind[0]
      buyers[s] = how === 'r' ? (G, k, r) => { const o = buyOptions20(G, k); return o[Math.floor(r() * o.length)] } : how === 'n' ? () => null : (G, k, r) => botBuy20(G, k, 'pressure', r)
    } else if (/^nspec(0|1|both)$/.test(kind)) {
      // never buys a special or the Super, but still takes the other end-of-round options (moving with Charge)
      const noTable = (G, k, r) => { const X = k === 0 ? G.A : G.B, Y = { ...X, table: [], superAt: X.superAt === 'table' ? 'gone' : X.superAt }; return chooseBuy20(k === 0 ? { ...G, A: Y } : { ...G, B: Y }, k, W, r) }
      for (const s of kind.endsWith('both') ? [0, 1] : [+kind.at(-1)]) buyers[s] = noTable
    } else if (/^savem?[01]$/.test(kind)) {
      // the cap test (14 Nov): one side saves for the Super. 'save' never spends otherwise; 'savem' still moves with Charge
      const s = +kind.at(-1), mv = kind[4] === 'm'
      const noTable = (G, k, r) => { const X = k === 0 ? G.A : G.B, Y = { ...X, table: [], superAt: X.superAt === 'table' ? 'gone' : X.superAt }; return chooseBuy20(k === 0 ? { ...G, A: Y } : { ...G, B: Y }, k, W, r) }
      buyers[s] = (G, k, r) => { const o = buyOptions20(G, k); if (o.includes('S')) return 'S'; return mv ? noTable(G, k, r) : null }
    } else if (/^(odg|nod|nex|nsp|onlyod)[01]$/.test(kind)) {
      // v23 (16 Nov): one side Overdrives whenever it can ('odg'), never Overdrives ('nod'), never exchanges ('nex'),
      // never spends Charge ('nsp': no Overdrive, no moving), or spends only on Overdrive ('onlyod': no moving)
      const s = +kind.at(-1), how = kind.slice(0, -1)
      const parts = o => (o === null ? [] : String(o).split('|')), has = (o, p) => parts(o).some(x => x === p || (p === 'X' && x.startsWith('X:')))
      const keep = { nod: o => !has(o, 'O'), nex: o => !has(o, 'X'), nsp: o => !has(o, 'O') && !has(o, 'M'), onlyod: o => !has(o, 'M') }[how]
      buyers[s] = how === 'odg' ? (G, k, r) => (buyOptions20(G, k).includes('O') ? 'O' : chooseBuy20(G, k, Ws[k], r)) : (G, k, r) => chooseBuy20(G, k, Ws[k], r, 'hard', keep)
    } else if (kind === 'kb0') { Ws = [dropKeys(W), W]
    } else if (kind === 'kb1') { Ws = [W, dropKeys(W)]
    } else if (kind === 'deep1') { buyers = [null, deepBuy]
    } else if (kind === 'random0') { levels = ['random', 'hard']
    } else if (kind === 'random1') { levels = ['hard', 'random']
    } else if (kind === 'fitted') { Ws = [{ ...W, fit: FIT }, W]
    } else if (kind === 'deepfit') { Ws = [{ ...W, fit: FIT }, { ...W, fit: FIT }]; buyers = [deepBuy, null]; DEEP_W = { ...W, fit: FIT }
    } else if (kind === 'rangeaware') { Ws = [{ ...W, rangeW }, W]
    } else if (kind === 'deep') { buyers = [deepBuy, null]
    } else if (kind === 'notrade1') { buyers = [null, (G, k, r) => chooseBuy20({ ...G, rules: { ...G.rules, trade: false } }, k, W, r)]
    } else if (kind === 'honest') { pickers = [honestPicker, null]
    } else if (kind === 'rhonest') { pickers = [rhonestPicker, null]; stancers = [randomStance, null]; buyers = [() => null, null]
    } else if (kind === 'rtype' || kind === 'rcard') { pickers = [splitPicker(kind), null]; buyers = [() => null, null]
    } else if (kind.startsWith('bot:')) { levels = [kind.slice(4), 'hard']; if (botsNeverBuy) buyers[0] = () => null }
    if (kind === 'hard' && rules.stance) onRound = rec => { for (const k of [0, 1]) if (rec.stance && rec.types?.[k]) { feints.n++; if (rec.types[k] !== rec.stance[k]) feints.f++ } }
    games.push(playGame18(fa, fb, { rules, W, Ws, levels, seed: sd * 100003 + i, rng, pickers, onRound, buyers, stancers, combos, discarders }))
  }
  return { games, gaps, mix, feints, rows, names: [fa.name, fb.name], prefs: [fa.prefers, fb.prefers], caps: [fa.greyCap || rules.greyCap, fb.greyCap || rules.greyCap] }
}

// ---- reading the games ----------------------------------------------------------------------
function luck(games) {
  let wins = 0, decided = 0, decisive = 0, topShare = 0, timeouts = 0, bigDmg = 0
  const acts = [{ buy: 0, pair: 0, three: 0, flip: 0 }, { buy: 0, pair: 0, three: 0, flip: 0 }]
  let farRounds = 0, nRounds = 0, whiffs = [0, 0], wall = [0, 0]
  for (const g of games) for (const r of g.rounds) {
    nRounds++; if (r.range === "far") farRounds++
    for (const k of r.whiffs || []) whiffs[k]++
    if (r.sides) for (const k of [0, 1]) if (r.sides[k] === 'wall') wall[k]++
    for (const k of [0, 1]) { const b = r.bought?.[k]; if (b) acts[k][b.flip ? 'flip' : b.trade === 2 ? 'pair' : b.trade === 3 ? 'three' : 'buy']++ }
  }
  const rounds = []
  for (const g of games) {
    wins += g.result; rounds.push(g.rounds.length); if (g.timedOut) timeouts++
    if (g.result === 0.5) continue
    const loser = g.result === 1 ? 1 : 0
    const hp = g.rounds.map(r => r.before[loser].hp).concat([g.final[loser].hp])
    const loss = hp.slice(1).map((v, i) => hp[i] - v)
    const total = loss.reduce((a, v) => a + Math.max(0, v), 0)
    if (total <= 0) continue
    const top = Math.max(...loss) / total
    decided++; topShare += top; bigDmg += Math.max(...loss); if (top >= 0.4) decisive++
  }
  rounds.sort((x, y) => x - y)
  return { win: wins / games.length, median: rounds[Math.floor(rounds.length / 2)], timeouts: timeouts / games.length,
    decisive: decisive / Math.max(1, decided), topShare: topShare / Math.max(1, decided), bigDmg: bigDmg / Math.max(1, decided),
    acts: acts.map(a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v / games.length]))),
    far: farRounds / Math.max(1, nRounds), whiffs: whiffs.map(v => v / games.length), wall: wall.map(v => v / Math.max(1, nRounds)) }
}
// Range test stats: range changes a game, the share of clashes each side fought at its own range, flips a game
function rangeStats(games, prefs, caps) {
  let changes = 0, n = 0, home = [0, 0], flips = [0, 0], buys = [0, 0], away = [0, 0], moves = [0, 0], supers = [0, 0]
  for (const g of games) for (const r of g.rounds) {
    n++; if (r.rangeAt && r.range !== r.rangeAt) changes++
    for (const k of [0, 1]) {
      if (r.rangeAt === prefs[k]) home[k]++
      if (r.sides?.[k] === 'away') away[k]++
      if (r.supers?.[k]) supers[k]++
      const b = r.bought?.[k]; if (b) { if (b.flip) flips[k]++; else if (b.move) moves[k]++; else if (!b.trade) buys[k]++ }
    }
  }
  // snowball check: the player ahead on HP halfway through (by rounds) wins how often; Guard share of clash cards;
  // the share of rounds each player starts Fully Charged
  let led = 0, ledWins = 0, guards = [0, 0], cards = [0, 0], full = [0, 0]
  for (const g of games) {
    const mid = g.rounds[Math.floor(g.rounds.length / 2)]
    if (mid && g.result !== 0.5) { const [a, b] = [mid.before[0].hp, mid.before[1].hp]; if (a !== b) { led++; if ((a > b) === (g.result === 1)) ledWins++ } }
    for (const r of g.rounds) for (const k of [0, 1]) {
      if (r.types?.[k]) { cards[k]++; if (r.types[k] === 'R') guards[k]++ }
      if (caps?.[k] && r.before[1 - k].pile >= caps[k]) full[k]++
    }
  }
  // snowball diagnostics (14 Nov): a no-momentum baseline (each game's round-by-round HP swings in a random order),
  // the clash win rate at your range and away, the leader split by where the fight was at halfway, and how long
  // a player stays off their range
  let sAct = 0, sBase = 0, sN = 0, srng = 12345
  const rnd = () => ((srng = (srng * 1103515245 + 12345) % 2147483648) / 2147483648)
  const cw = { home: [0, 0], away: [0, 0] }, none = { home: [0, 0], away: [0, 0] }, lead = { home: [0, 0], away: [0, 0], neutral: [0, 0] }, spells = []
  for (const g of games) {
    const R = g.rounds; if (!R.length) continue
    const M = [R[0].before[0].hp, R[0].before[1].hp], sh = x => x[0].hp / M[0] - x[1].hp / M[1]   // HP shares, so asymmetric HP doesn't count as a lead
    const diff = R.map(r => sh(r.before)).concat([sh(g.final)])
    const d = diff.slice(1).map((v, i) => v - diff[i]), tot = diff[diff.length - 1] - diff[0], h = Math.floor(R.length / 2)
    if (tot !== 0) {
      const part = diff[h] - diff[0]
      if (part !== 0 && g.result !== 0.5) { sN++; if ((part > 0) === (g.result === 1)) sAct++ }
      for (let t = 0; t < 20; t++) { const e = d.slice(); for (let i = e.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [e[i], e[j]] = [e[j], e[i]] }
        const ps = e.slice(0, h).reduce((a, v) => a + v, 0); if (ps !== 0) { sBase += (Math.sign(ps) === Math.sign(tot)) / 20 } else sBase += 0.5 / 20 }
    }
    for (const r of R) for (const k of [0, 1]) { if (!r.rangeAt || !prefs[k]) continue; const w = r.rangeAt === prefs[k] ? 'home' : 'away'; cw[w][1]++; if (r.winner === k) cw[w][0]++; none[w][1]++; if (!r.cards?.[k]) none[w][0]++ }
    const mid = R[h]
    if (mid && g.result !== 0.5 && mid.rangeAt) { const [a, b] = [mid.before[0].hp / M[0], mid.before[1].hp / M[1]]; if (a !== b) { const L = a > b ? 0 : 1; const w = !prefs[L] ? 'neutral' : mid.rangeAt === prefs[L] ? 'home' : 'away'; lead[w][1]++; if ((L === 0) === (g.result === 1)) lead[w][0]++ } }
    for (const k of [0, 1]) { let run = 0; for (const r of R) { if (r.rangeAt && prefs[k] && r.rangeAt !== prefs[k]) run++; else { if (run) spells.push(run); run = 0 } } if (run) spells.push(run) }
  }
  // escape check (14 Nov): away from your range, what you held (a mover that reaches, your own moving Guard,
  // 3 Charge) and how often the fight was back at your range by the next clash; long spells against short ones
  const esc = { any: 0, mv: 0, gd: 0, ch: 0, none: 0 }, back = { mv: [0, 0], gdOnly: [0, 0], chOnly: [0, 0], none: [0, 0] }
  const usedMv = [0, 0], spellNone = { long: [0, 0], short: [0, 0] }, spellEver = { long: [0, 0], short: [0, 0] }
  for (const g of games) {
    const R = g.rounds
    for (const k of [0, 1]) {
      if (!prefs[k]) continue
      let cur = []
      const close = () => { if (!cur.length) return; const w = cur.length >= 5 ? 'long' : 'short'
        spellNone[w][1] += cur.length; spellNone[w][0] += cur.filter(e => !e.mv && !e.gd && !e.ch).length
        spellEver[w][1]++; if (cur.some(e => e.mv || e.gd)) spellEver[w][0]++; cur = [] }
      R.forEach((r, i) => {
        const e = r.esc?.[k]
        if (!r.rangeAt || !e || r.rangeAt === prefs[k]) { close(); return }
        cur.push(e); esc.any++
        if (e.mv) esc.mv++; if (e.gd) esc.gd++; if (e.ch) esc.ch++; const none = !e.mv && !e.gd && !e.ch; if (none) esc.none++
        if (e.mv) { usedMv[1]++; if (e.mvNames?.includes(r.cards?.[k])) usedMv[0]++ }
        const nx = R[i + 1]; if (!nx) return
        const b = e.mv ? 'mv' : e.gd ? 'gdOnly' : e.ch ? 'chOnly' : 'none'
        back[b][1]++; if (nx.rangeAt === prefs[k]) back[b][0]++
      })
      close()
    }
  }
  // Charge levels (14 Nov): what each player holds at the start of a round, their peak in a game, Super buys
  const chg = [0, 1].map(() => ({ sum: 0, n: 0, ge3: 0, ge6: 0, half: 0, peak: 0, games: 0, peaks: [] }))
  for (const g of games) for (const k of [0, 1]) { let pk = 0; for (const r of g.rounds) { const c = r.before[1 - k].pile || 0, C = chg[k]; C.sum += c; C.n++; if (c >= 3) C.ge3++; if (c >= 6) C.ge6++; if (caps?.[k] && c >= caps[k] / 2) C.half++; pk = Math.max(pk, c) } chg[k].peaks.push(pk) }
  const charge = chg.map((C, k) => ({ mean: C.sum / Math.max(1, C.n), ge3: C.ge3 / Math.max(1, C.n), ge6: C.ge6 / Math.max(1, C.n), halfCap: C.half / Math.max(1, C.n), peakMean: C.peaks.reduce((a, v) => a + v, 0) / Math.max(1, C.peaks.length), reachedCap: caps?.[k] ? C.peaks.filter(v => v >= caps[k]).length / Math.max(1, C.peaks.length) : null }))
  const fr = ([a, b]) => b ? a / b : null
  const snow = { actual: sN ? sAct / sN : null, shuffled: sN ? sBase / sN : null, clashWinHome: fr(cw.home), clashWinAway: fr(cw.away), playNothingHome: fr(none.home), playNothingAway: fr(none.away),
    leaderWinsAtOwnRange: fr(lead.home), leaderWinsAway: fr(lead.away), leaderAtOwnRangeShare: (lead.home[1] + lead.away[1]) ? lead.home[1] / (lead.home[1] + lead.away[1]) : null,
    escape: { playedMoverWhenHeld: fr(usedMv), heldMover: esc.any ? esc.mv / esc.any : null, heldGuard: esc.any ? esc.gd / esc.any : null, heldCharge: esc.any ? esc.ch / esc.any : null, heldNothing: esc.any ? esc.none / esc.any : null,
      backWithMover: fr(back.mv), backWithGuardOnly: fr(back.gdOnly), backWithChargeOnly: fr(back.chOnly), backWithNothing: fr(back.none), nN: back.none[1], gN: back.gdOnly[1], cN: back.chOnly[1],
      longSpellNothingShare: fr(spellNone.long), shortSpellNothingShare: fr(spellNone.short), longSpellsEverHeldEscape: fr(spellEver.long), shortSpellsEverHeldEscape: fr(spellEver.short) },
    awaySpellMean: spells.length ? spells.reduce((a, v) => a + v, 0) / spells.length : null, awaySpell5plus: spells.length ? spells.filter(v => v >= 5).length / spells.length : null }
  // v23 (16 Nov): Overdrive, the exchange, Guards drawing
  const G0 = gs => Math.max(1, gs.length)
  const v23 = [0, 1].map(() => ({ odRounds: 0, odBuys: 0, odStay: 0, odDmg: 0, odStreaks: [], exch: 0, loops: 0, exAway: 0, exMover: 0, guardDraws: 0, breakfall: 0, moves: 0, handClash: 0, n: 0, cIn: 0, cLost: 0, cEnd: 0, odSpent: 0 }))
  let odBig = 0, bigN = 0
  for (const g of games) {
    const R = g.rounds
    for (const k of [0, 1]) {
      const V = v23[k]; let run = 0
      R.forEach((r, i) => {
        V.n++; V.handClash += r.handAtClash?.[k] || 0
        if (r.od?.[k]) { V.odRounds++; run++ } else if (run) { V.odStreaks.push(run); run = 0 }
        V.odDmg += r.odDmg?.[k] || 0; V.guardDraws += r.guardDraws?.[k] || 0; if (r.breakfall?.[k]) V.breakfall++
        const b = r.bought?.[k]
        if (b?.od) { V.odBuys++; V.odSpent += b.cost || 0; if (b.staying) V.odStay++ }
        if (b?.move) V.moves++
        if (b?.exchange) {
          V.exch++
          if ((r.played?.[k] || []).includes(b.take)) V.loops++                      // took back a card it played this round
          if (prefs?.[k] && r.range && r.range !== prefs[k]) V.exAway++
        }
      })
      if (run) V.odStreaks.push(run)
      const cb = g.chargeBook?.[1 - k]                    // player k's Charge is the pile on the other player
      if (cb) { V.cIn += cb.in; V.cLost += cb.lost; V.cEnd += cb.end }
    }
    // the biggest round of a decided game: was the winner in Overdrive?
    if (g.result !== 0.5 && R.length) {
      const loser = g.result === 1 ? 1 : 0, w = 1 - loser
      const hp = R.map(r => r.before[loser].hp).concat([g.final[loser].hp]), loss = hp.slice(1).map((v, i) => hp[i] - v)
      const top = loss.indexOf(Math.max(...loss)); bigN++; if (R[top]?.od?.[w]) odBig++
    }
  }
  const v23out = v23.map(V => ({ odRoundsPerGame: V.odRounds / G0(games), odBuysPerGame: V.odBuys / G0(games), odStayShare: V.odBuys ? V.odStay / V.odBuys : null, odStreakMean: V.odStreaks.length ? V.odStreaks.reduce((a, v) => a + v, 0) / V.odStreaks.length : null,
    odDmgPerGame: V.odDmg / G0(games), exchPerGame: V.exch / G0(games), loopShare: V.exch ? V.loops / V.exch : null, exchAwayShare: V.exch ? V.exAway / V.exch : null,
    guardDrawsPerGame: V.guardDraws / G0(games), breakfallPerGame: V.breakfall / G0(games), movesPerGame: V.moves / G0(games), handAtClash: V.handClash / Math.max(1, V.n),
    // Charge bookkeeping (16 Nov): built, spent on moving (moves x the cost), on Overdrive, lost at the cap, left at the end
    chargeBuiltPerGame: V.cIn / G0(games), chargeMoveSpentPerGame: V.moves * (rules.chargeMove || 0) / G0(games), chargeODSpentPerGame: V.odSpent / G0(games),
    chargeLostPerGame: V.cLost / G0(games), chargeLeftPerGame: V.cEnd / G0(games) }))
  const G = games.length
  return { v23: v23out, odInBiggestRound: bigN ? odBig / bigN : null, snow, charge, leaderWins: ledWins / Math.max(1, led), guardShare: guards.map((v, k) => v / Math.max(1, cards[k])), fullShare: full.map(v => v / Math.max(1, n)), changes: changes / G, roundsPerChange: n / Math.max(1, changes), home: home.map(v => v / n), awaySide: away.map(v => v / n), flips: flips.map(v => v / G), buys: buys.map(v => v / G), moves: moves.map(v => v / G), supers: supers.map(v => v / G) }
}
const pct = x => (100 * x).toFixed(1) + '%'
const avg = a => (a?.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const gapLine = g => ['all', 'both empty', 'between', 'you full', 'them full'].map(k => `${k} ${(100 * avg(g[k])).toFixed(1)} (${g[k]?.length || 0})`).join(' · ')

const mode = args[0]
const t0 = Date.now()
if (mode === 'game') {
  const r = run(args[1], args[2] || args[1], 'hard'), L = luck(r.games)
  const out = { matchup: r.names, n, ...L, gap: Object.fromEntries(Object.entries(r.gaps).map(([k, v]) => [k, avg(v)])), gapN: Object.fromEntries(Object.entries(r.gaps).map(([k, v]) => [k, v.length])), mix: r.mix, feintRate: r.feints.n ? r.feints.f / r.feints.n : null }
  if (json) console.log(JSON.stringify(out))
  else {
    console.log(`${edition} · ${r.names.join(' v ')} · ${n} games (Hard v Hard)`)
    console.log(`side 0 wins ${pct(L.win)} · median ${L.median} rounds · time-outs ${pct(L.timeouts)}`)
    console.log(`decisive-clash share (one round ≥40% of the loser's damage) ${pct(L.decisive)} · average biggest round ${pct(L.topShare)} of it`)
    console.log(`decision gap (win-chance points, best card over the average): ${gapLine(r.gaps)}`)
  }
} else if (mode === 'bots') {
  const f = args[1] || 'benchmark', out = []
  for (const bot of botList) {
    const vsHard = luck(run(f, f, `bot:${bot}`).games).win
    const vsLearner = hardOnly ? null : 1 - luck(run(f, f, `learner:${bot}`).games).win
    out.push({ bot, vsHard, vsLearner })
    if (!json) console.log(`${bot.padEnd(8)} beats Hard ${pct(vsHard)} · beats the Learner ${pct(vsLearner)}`)
  }
  if (json) console.log(JSON.stringify(out))
} else if (mode === 'manage') {
  const f = args[1] || 'benchmark', out = {}
  out.sloppy = luck(run(f, f, 'sloppy').games).win
  out.random = luck(run(f, f, 'bot:random').games).win
  if (json) console.log(JSON.stringify(out)); else console.log(`sloppy hand management ${pct(out.sloppy)} · random at every decision ${pct(out.random)}`)
} else if (mode === 'habits') {
  const f = args[1] || 'benchmark', out = {}
  out.hard = luck(run(f, f, 'habitHard').games).win
  out.reader = luck(run(f, f, 'habitReader').games).win
  if (json) console.log(JSON.stringify(out)); else console.log(`against the habit bot: Hard ${pct(out.hard)} · the reader ${pct(out.reader)}`)
} else if (mode === 'record') {
  const r = run(args[1], args[2] || args[1], 'record')
  const res = r.games.map(g => g.result)
  console.log(JSON.stringify({ keys: FIT_KEYS, rows: r.rows.map(([x, gi]) => [x, res[gi]]) }))
} else if (mode === 'fitted' || mode === 'deepfit') {
  const L = luck(run(args[1], args[2] || args[1], mode).games)
  if (json) console.log(JSON.stringify({ n, ...L })); else console.log(`${mode} (side 0) beats Hard ${pct(L.win)} · median ${L.median}`)
} else if (mode === 'rangeaware') {
  const L = luck(run(args[1], args[2] || args[1], 'rangeaware').games)
  if (json) console.log(JSON.stringify({ n, ...L })); else console.log(`range-aware Hard (side 0) beats Hard ${pct(L.win)} · median ${L.median}`)
} else if (mode === 'deep') {
  const L = luck(run(args[1], args[2] || args[1], 'deep').games)
  if (json) console.log(JSON.stringify({ n, ...L })); else console.log(`the deeper planner (side 0) beats Hard ${pct(L.win)} · median ${L.median} · time-outs ${pct(L.timeouts)} · buys a game ${L.acts.map(a => a.buy.toFixed(2)).join(' / ')}`)
} else if (mode === 'tradevalue') {
  const L = luck(run(args[1], args[2] || args[1], 'notrade1').games)
  if (json) console.log(JSON.stringify({ n, ...L })); else console.log(`side 0 (trades) beats side 1 (never trades) ${pct(L.win)} · median ${L.median} · time-outs ${pct(L.timeouts)}`)
} else if (mode === 'stance') {
  const f = args[1] || 'benchmark', out = {}
  out.random = luck(run(f, f, 'bot:random').games).win
  out.honest = luck(run(f, f, 'honest').games).win
  out.rhonest = luck(run(f, f, 'rhonest').games).win
  if (json) console.log(JSON.stringify(out)); else console.log(`random ${pct(out.random)} · never feints ${pct(out.honest)} · random stance, best card of it ${pct(out.rhonest)}`)
} else if (mode === 'split') {
  const f = args[1] || 'benchmark', out = {}
  for (const kind of ['rtype', 'rcard']) out[kind] = luck(run(f, f, kind).games).win
  if (json) console.log(JSON.stringify(out)); else console.log(`random type, best card ${pct(out.rtype)} · Hard's type, random card ${pct(out.rcard)} (both never buy)`)
} else if (mode === 'rangetest') {
  // node tools/luck.mjs --edition r1 rangetest brawler zoner --kinds hard,blind0,blind1 -n 300
  const kinds = (opt('--kinds', null) || args[3] || 'hard').split(','), out = []
  for (const kind of kinds) {
    const r = run(args[1], args[2] || args[1], kind), L = luck(r.games), S = rangeStats(r.games, r.prefs, r.caps)
    out.push({ kind, matchup: r.names, n, win: L.win, median: L.median, timeouts: L.timeouts, decisive: L.decisive, topShare: L.topShare, bigDmg: L.bigDmg, ...S })
    if (!json) console.log(`${kind.padEnd(12)} ${r.names.join(' v ')}: side 0 ${pct(L.win)} · median ${L.median} · time-outs ${pct(L.timeouts)} · range changes ${S.changes.toFixed(1)} a game (every ${S.roundsPerChange.toFixed(1)} rounds) · at own range ${S.home.map(pct).join(' / ')} · away side ${S.awaySide.map(pct).join(' / ')} · flips ${S.flips.map(v => v.toFixed(1)).join(' / ')} · buys ${S.buys.map(v => v.toFixed(1)).join(' / ')}`)
  }
  if (json) console.log(JSON.stringify(out))
} else if (mode === 'clashvalue') {
  // What winning a clash is worth (17 Nov, price list): Hard v Hard, every round with a winner, split by the
  // winning card's type and the winner's fighter. Measured over the clash and everything it set off (follow-ups,
  // combos), before the end of the round: damage dealt, Charge built (the winner's Charge sits on the loser's pile),
  // knockdowns, cards played, the hand swing (winner's hand change minus loser's), and where the fight ended.
  // node tools/luck.mjs --edition v23e clashvalue brawler zoner -n 300 --json
  const r = run(args[1], args[2] || args[1], 'hard'), names = r.names, prefs = r.prefs
  const T = {}, add = (key, o) => { const t = T[key] || (T[key] = { n: 0, dmg: 0, charge: 0, kd: 0, extra: 0, swing: 0, od: 0 }); t.n++; for (const k in o) t[k] += o[k] }
  let rounds = 0, noWinner = { guards: 0, other: 0 }
  for (const g of r.games) for (const rec of g.rounds) {
    rounds++
    const w = rec.winner
    if (w == null || w < 0) { if (rec.outcome === 'guards') noWinner.guards++; else noWinner.other++; continue }
    const l = 1 - w, t = rec.types[w]
    const dmg = rec.before[l].hp - rec.after[l].hp
    const charge = Math.max(0, rec.after[l].pile - rec.before[l].pile)
    const kd = (rec.statuses[l] || []).includes('Knockdown') ? 1 : 0
    const extra = (rec.follow && rec.follow.side === w ? 1 : 0) + (rec.combo || []).filter(x => x.side === w).length
    const swing = (rec.after[w].hand - rec.before[w].hand) - (rec.after[l].hand - rec.before[l].hand)
    const startHome = rec.rangeAt === prefs[w]
    const od = rec.od?.[w] ? 1 : 0
    const o = { dmg, charge, kd, extra, swing, od }
    add(`${names[w]} ${t}`, o); add(`all ${t}`, o); add('all', o)
    add(`${names[w]} ${t} ${startHome ? 'home' : 'away'}`, o)
  }
  const out = { n, rounds, noWinner, rows: Object.fromEntries(Object.entries(T).map(([k, t]) => [k, { n: t.n, share: t.n / rounds, dmg: t.dmg / t.n, charge: t.charge / t.n, kd: t.kd / t.n, extra: t.extra / t.n, swing: t.swing / t.n, od: t.od / t.n }])) }
  if (json) console.log(JSON.stringify(out))
  else {
    console.log(`${rounds} rounds; no winner: two Guards ${pct(noWinner.guards / rounds)}, other ${pct(noWinner.other / rounds)}`)
    for (const [k, v] of Object.entries(out.rows).sort()) console.log(`${k.padEnd(22)} ${pct(v.share).padStart(6)} of rounds · damage ${v.dmg.toFixed(2)} · Charge ${v.charge.toFixed(2)} · knockdown ${pct(v.kd)} · extra hits ${v.extra.toFixed(2)} · hand swing ${v.swing.toFixed(2)} · in Overdrive ${pct(v.od)}`)
  }
} else if (mode === 'learner') {
  const L = luck(run(args[1], args[2] || args[1], 'learner').games)
  if (json) console.log(JSON.stringify({ n, ...L })); else console.log(`the Learner (side 0) beats Hard ${pct(L.win)} · median ${L.median}`)
} else console.log('usage: node tools/luck.mjs game <a> [b] | bots [fighter] | learner <a> [b]  [-n] [--seed] [--set k=v] [--hp a,b] [--json]')
if (!json) console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`)
