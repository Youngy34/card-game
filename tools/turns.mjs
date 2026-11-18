// Option B measurements (18 Nov, claude/turns and footwork - idea ready to sim (18 Nov).md): Hard v Hard games and
// what the footwork and turns ideas are meant to change.
//   node tools/turns.mjs --edition v23turn brawler zoner -n 300 --seed 5 [--set k=v ...] [--json out.json]
// Prints (and writes, with --json) one summary from the first fighter's seat; run the other seat order too and pool
// with --pool a.json,b.json.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toFighter16 } from '../src/engine/v16/cards.js'
import { playGame18, mulberry } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d }
const opts = name => { const out = []; let i; while ((i = args.indexOf(name)) >= 0) out.push(args.splice(i, 2)[1]); return out }
const poolArg = opt('--pool', null)

// ---- per-game raw tallies --------------------------------------------------------------------------------------
function tally(games, names, prefs) {
  // index by fighter name so both seat orders pool
  const T = { games: 0, rounds: 0, bWins: 0, firstWins: 0, firstN: 0, timeouts: 0, lengths: [], decided: 0, decisive: 0,
    changes: 0, turnMoves: 0, answered: 0, fwMoves: 0, chMoves: 0, turns: 0, acts: { 0: 0, 1: 0, 2: 0 }, kinds: {},
    odBuys: 0, odDouble: 0, odRounds: 0, moveOd: 0, moveOdDmg: 0, otherOdDmg: 0, otherOdN: 0, selfZone: 0, zoneHits: 0,
    by: {} }
  for (const nm of names) T.by[nm] = { clashAway: 0, le2Away: 0, one: 0, early: 0, earlyLe2: 0, clashHome: 0, le2Home: 0, spells: [], hand: 0, n: 0, guards: 0, cards: 0, choicesAway: 0, wins: 0 }
  for (const { g, seat } of games) {
    const N = [names[seat[0]], names[seat[1]]], P = [prefs[seat[0]], prefs[seat[1]]]
    T.games++; T.rounds += g.rounds.length; T.lengths.push(g.rounds.length); if (g.timedOut) T.timeouts++
    const bSide = N[0] === 'Brawler' ? 0 : N[1] === 'Brawler' ? 1 : null
    if (bSide !== null) T.bWins += bSide === 0 ? g.result : 1 - g.result
    const first = g.rounds[0]?.init
    if (first === 0 || first === 1) { T.firstN++; T.firstWins += first === 0 ? g.result : 1 - g.result }
    // swing, as luck.mjs: games where one round dealt 40%+ of the damage the loser took
    if (g.result !== 0.5) {
      const loser = g.result === 1 ? 1 : 0
      const hp = g.rounds.map(r => r.before[loser].hp).concat([g.final[loser].hp + (g.penalty?.side === loser ? g.penalty.hp : 0)])
      const loss = hp.slice(1).map((v, i) => hp[i] - v), tot = loss.reduce((a, v) => a + Math.max(0, v), 0)
      if (tot > 0) { T.decided++; if (Math.max(...loss) / tot >= 0.4) T.decisive++ }
    }
    for (const k of [0, 1]) {
      const B = T.by[N[k]]
      if (g.result !== 0.5) B.wins += k === 0 ? g.result : 1 - g.result
      let run = 0
      g.rounds.forEach((r, i) => {
        const away = r.rangeAt && P[k] && r.rangeAt !== P[k]
        B.n++; B.hand += r.handAtClash?.[k] || 0
        if (r.types?.[k]) { B.cards++; if (r.types[k] === 'R') B.guards++ }
        const ch = r.choices?.[k] ?? 0
        if (away) {
          B.clashAway++; B.choicesAway += ch; if (ch <= 2) B.le2Away++; if (ch <= 1) B.one++
          if (i < 4) { B.early++; if (ch <= 2) B.earlyLe2++ }
          run++
        } else {
          if (r.rangeAt) { B.clashHome++; if (ch <= 2) B.le2Home++ }
          if (run) B.spells.push(run); run = 0
        }
      })
      if (run) B.spells.push(run)
    }
    // range changes (clash to clash), turn moves, answered moves, actions, Overdrive
    g.rounds.forEach((r, i) => {
      const nx = g.rounds[i + 1]
      if (nx && nx.rangeAt !== r.rangeAt) T.changes++
      for (const k of [0, 1]) {
        const b = r.bought?.[k]
        const acts = b ? (b.acts || [b]) : []
        if (r.init === k || !g.rounds[0]?.bought) { /* holder's turn */ }
        if (b || r.init === k) { if (r.init === k) { T.turns++; T.acts[Math.min(2, acts.length)]++ } }
        for (const a of acts) { const key = a.footwork ? 'footwork' : a.move ? 'charge move' : a.od ? 'overdrive' : a.chargeUp ? 'charge up' : a.zone ? 'zone' : a.name; T.kinds[key] = (T.kinds[key] || 0) + 1 }
        if (!b) continue
        if (b.move) {
          T.turnMoves++; if (b.footwork) T.fwMoves++; else T.chMoves++
          // answered: the opponent's next end-of-round moves it straight back (today's rules: the same end of round)
          const ob = r.bought?.[1 - k], nb = g.rounds[i + 1]?.bought?.[1 - k]
          if ((ob?.move && ob.move !== b.move && r.init === k) || (nb?.move && nb.move !== b.move)) T.answered++
          if (b.acts?.some(a => a.zone) && b.move === 'close') T.selfZone++
        }
        const nOd = acts.filter(a => a.od).length
        if (nOd) { T.odBuys++; if (nOd >= 2) T.odDouble++ }
        // the clash after a move plus Overdrive turn: the damage the mover dealt in it
        if (nx && nOd) {
          const d = nx.before[1 - k].hp - (g.rounds[i + 2]?.before[1 - k].hp ?? g.final[1 - k].hp)
          if (b.move) { T.moveOd++; T.moveOdDmg += d } else { T.otherOdN++; T.otherOdDmg += d }
        }
      }
      for (const k of [0, 1]) if (r.od?.[k]) T.odRounds++
    })
  }
  return T
}
function report(T) {
  const p = x => (100 * x).toFixed(1) + '%', f = (a, b) => (b ? a / b : 0)
  const s = [...T.lengths].sort((a, b) => a - b)
  const out = {
    games: T.games, brawler: f(T.bWins, T.games), firstPlayer: f(T.firstWins, T.firstN), timeouts: f(T.timeouts, T.games),
    median: s[s.length >> 1], swing: f(T.decisive, T.decided),
    rangeChangesPerGame: f(T.changes, T.games), turnMovesPerGame: f(T.turnMoves, T.games), footworkPerGame: f(T.fwMoves, T.games), chargeMovesPerGame: f(T.chMoves, T.games),
    answeredShare: f(T.answered, T.turnMoves), selfZonePerGame: f(T.selfZone, T.games),
    actions: { none: f(T.acts[0], T.turns), one: f(T.acts[1], T.turns), two: f(T.acts[2], T.turns) },
    kindsPerGame: Object.fromEntries(Object.entries(T.kinds).map(([k, v]) => [k, f(v, T.games)])),
    odBuysPerGame: f(T.odBuys, T.games), odDoublePerGame: f(T.odDouble, T.games), odRoundsPerGame: f(T.odRounds, T.games),
    dmgAfterMoveOd: f(T.moveOdDmg, T.moveOd), moveOdPerGame: f(T.moveOd, T.games), dmgAfterOtherOd: f(T.otherOdDmg, T.otherOdN),
    by: Object.fromEntries(Object.entries(T.by).map(([nm, B]) => [nm, {
      awayShare: f(B.clashAway, B.n), le2Away: f(B.le2Away, B.clashAway), oneAway: f(B.one, B.clashAway), meanChoicesAway: f(B.choicesAway, B.clashAway),
      earlyLe2Away: f(B.earlyLe2, B.early), le2Home: f(B.le2Home, B.clashHome),
      spellMean: f(B.spells.reduce((a, v) => a + v, 0), B.spells.length), spell3plus: f(B.spells.filter(v => v >= 3).length, B.spells.length), spellMax: Math.max(0, ...B.spells),
      handAtClash: f(B.hand, B.n), guardShare: f(B.guards, B.cards) }]))
  }
  return out
}
function print(o) {
  const p = x => (100 * x).toFixed(1) + '%', d = x => x.toFixed(2)
  console.log(`games ${o.games} · Brawler ${p(o.brawler)} · first player ${p(o.firstPlayer)} · time-outs ${p(o.timeouts)} · median ${o.median} · swing ${p(o.swing)}`)
  console.log(`range changes/game ${d(o.rangeChangesPerGame)} · end-of-round moves/game ${d(o.turnMovesPerGame)} (footwork ${d(o.footworkPerGame)}, Charge ${d(o.chargeMovesPerGame)}) · answered straight back ${p(o.answeredShare)} · zone then own move ${d(o.selfZonePerGame)}/game`)
  console.log(`turns: no action ${p(o.actions.none)}, one ${p(o.actions.one)}, two ${p(o.actions.two)} · actions/game ${Object.entries(o.kindsPerGame).map(([k, v]) => `${k} ${d(v)}`).join(', ')}`)
  console.log(`Overdrive: buys/game ${d(o.odBuysPerGame)}, double ${d(o.odDoublePerGame)}, rounds in it ${d(o.odRoundsPerGame)} · Damage in the clash after move+Overdrive ${d(o.dmgAfterMoveOd)} (${d(o.moveOdPerGame)}/game), after other Overdrive ${d(o.dmgAfterOtherOd)}`)
  for (const [nm, B] of Object.entries(o.by)) console.log(`  ${nm}: away ${p(B.awayShare)} · at the weak range ≤2 choices ${p(B.le2Away)}, 1 choice ${p(B.oneAway)}, mean ${d(B.meanChoicesAway)} · rounds 1-4 away ≤2 ${p(B.earlyLe2Away)} · home ≤2 ${p(B.le2Home)} · away spells mean ${d(B.spellMean)}, 3+ ${p(B.spell3plus)}, longest ${B.spellMax} · hand ${d(B.handAtClash)} · Guard share ${p(B.guardShare)}`)
}

if (poolArg) {
  // pool raw tallies saved with --json
  const parts = poolArg.split(',').map(f => JSON.parse(fs.readFileSync(f, 'utf8')).raw)
  const T = parts[0]
  for (const q of parts.slice(1)) {
    for (const k of Object.keys(q)) {
      if (k === 'by') { for (const nm of Object.keys(q.by)) { const A = T.by[nm] || (T.by[nm] = q.by[nm]); if (A === q.by[nm]) continue; for (const kk of Object.keys(A)) A[kk] = Array.isArray(A[kk]) ? A[kk].concat(q.by[nm][kk]) : A[kk] + q.by[nm][kk] } }
      else if (k === 'acts' || k === 'kinds') { for (const kk of Object.keys(q[k])) T[k][kk] = (T[k][kk] || 0) + q[k][kk] }
      else if (Array.isArray(T[k])) T[k] = T[k].concat(q[k])
      else T[k] += q[k]
    }
  }
  const o = report(T); print(o)
  const jo = opt('--json', null); if (jo) fs.writeFileSync(jo, JSON.stringify({ report: o, raw: T }))
} else {
  const edition = opt('--edition', 'v23turn'), n = +opt('-n', 300), seed = +opt('--seed', 5), jsonOut = opt('--json', null), sets = opts('--set')
  const settings = JSON.parse(fs.readFileSync(`${root}/data/${edition}/settings.json`, 'utf8'))
  const rules = { ...settings.rules }
  const parse = v => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v)
  for (const s of sets) { const [k, v] = s.split('='); rules[k] = parse(v) }
  const W = { ...DEFAULT_W16, ...settings.ai }
  const [a, b] = args
  const fa = toFighter16(JSON.parse(fs.readFileSync(`${root}/data/${edition}/${a}.json`, 'utf8'))), fb = toFighter16(JSON.parse(fs.readFileSync(`${root}/data/${edition}/${b}.json`, 'utf8')))
  const rng = mulberry(seed * 7919 + 13), games = []
  for (let i = 0; i < n; i++) games.push({ g: playGame18(fa, fb, { rules, W, seed: seed * 100003 + i, rng }), seat: [0, 1] })
  const names = [fa.name, fb.name], prefs = [fa.prefers, fb.prefers]
  const T = tally(games, names, prefs)
  const o = report(T); print(o)
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ edition, sets, matchup: names, report: o, raw: T }))
}
