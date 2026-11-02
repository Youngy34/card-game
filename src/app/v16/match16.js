// One v16 match at the table: pure state transitions, no UI.
//
// Phases: 'neutral' (each player picks a neutral action) -> 'confiscate' (if a
// Shakedown took a card) -> 'clash' (each picks a clash card) -> 'stage' (a follow-up,
// Linker or Ender to choose) -> 'confiscate' (if a hit took cards) -> 'reveal' (the
// round's result) -> 'discard' (down to the hand limit, if over) -> 'neutral' ... 'over'.
// A sparring partner decides at once; a person's turn sets m.turn.
// In hot-seat play, m.pass asks for the device to change hands before a private choice.

import { newGame16, applyNeutral16, startClash16, decideClash16, startDraw16, discardDown16, clashOptions16, neutralOptions16,
         card16, unseenPool, unseenCounts, superReady, statusList, iconOptions, speedOf, confiscate16, handLimitOf, neutralModes16, initOrder, tableCost } from '../../engine/v16/engine.js'
import { toFighter16, fighterHash16 } from './fighters16.js'
import { clashMix16, neutralChoice16, bestChoice16, botNeutral, botClash, chooseDiscards, chooseConfiscate, chooseMode16, sampleIndex, LEVELS16, BOTS16 } from '../../engine/v16/ai.js'
import { roundRecord16, winRoute16, snap16 } from '../../engine/v16/game.js'
import { LABEL16, STATUSES } from '../../engine/v16/cards.js'

const HUMANS = { ai: [true, false], hotseat: [true, true], watch: [false, false] }
export const WHO16 = { ai: ['You', 'Sparring partner'], hotseat: ['Player 1', 'Player 2'], watch: ['Partner 1', 'Partner 2'] }

function aiRng(m) {
  const R = { s: m.aiRng }
  const f = () => {
    R.s = (R.s + 0x6D2B79F5) >>> 0
    let t = R.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return [f, () => R.s]
}

export function startMatch16({ fighters, statuses, mode, settings, levels = ['hard', 'hard'], seed = (Math.random() * 2 ** 32) >>> 0, id }) {
  const f = fighters.map(toFighter16)
  const rules = { ...settings.rules }
  const G = newGame16(f[0], f[1], rules, seed)
  const m = {
    id, mode, humans: HUMANS[mode], levels, json: fighters, statuses: statuses || ['', ''], settingsUsed: settings,
    W: settings.ai, G, seed, aiRng: (seed ^ 0x9E3779B9) >>> 0, history: [], result: null, startedAt: Date.now(),
    phase: 'neutral', turn: null, pass: false, acts: [undefined, undefined], picks: [undefined, undefined],
    lastChooser: null, roundBefore: null, decisions: null, aiMix: [null, null], aiNeutral: [null, null], last: null,
  }
  return beginNeutral(m)
}

const isHuman = (m, k) => m.humans[k]
const P = (m, k) => (k === 0 ? m.G.A : m.G.B)

// Hot-seat: ask for the device to change hands when the next private choice is the other player's
function handTo(m, side) {
  const pass = m.mode === 'hotseat' && m.lastChooser !== null && m.lastChooser !== side
  return { ...m, turn: side, pass }
}

// ---- 1. neutral -------------------------------------------------------------------
function beginNeutral(m) {
  m = { ...m, phase: 'neutral', acts: [undefined, undefined], picks: [undefined, undefined], roundBefore: [snap16(m.G.A), snap16(m.G.B)],
        decisions: { neutral: [null, null], picks: [null, null], stages: [], discards: [null, null] }, aiMix: [null, null], aiNeutral: [null, null],
        confiscated: [[], []], confPre: [0, 0], confNext: null }
  const [rng, state] = aiRng(m)
  const acts = [undefined, undefined]
  for (const k of [0, 1]) {
    const X = P(m, k)
    if (neutralOptions16(X, m.G.rules).skip) { acts[k] = null; continue }
    if (isHuman(m, k)) continue
    if (BOTS16[m.levels[k]]) acts[k] = botNeutral(m.G, k, m.levels[k], rng)
    else {
      const c = neutralChoice16(m.G, k, m.W, rng, m.levels[k])
      acts[k] = c.act
      m.aiNeutral[k] = c
    }
  }
  m = { ...m, acts, aiRng: state() }
  return nextNeutral(m)
}

function nextNeutral(m) {
  const k = [0, 1].find(s => m.acts[s] === undefined)
  if (k === undefined) return m.G.rules.tableCards ? nextOption({ ...m, optDone: [false, false] }) : applyNeutral(m)
  return handTo({ ...m, phase: 'neutral' }, k)
}

// act: null (nothing), { kind: 'draw' }, { kind: 'neutral', i }, { kind: 'burn', cards }
export function chooseNeutral(m, side, act) {
  const acts = m.acts.slice(); acts[side] = act
  const decisions = { ...m.decisions, neutral: Object.assign(m.decisions.neutral.slice(), { [side]: act }) }
  return nextNeutral({ ...m, acts, decisions, lastChooser: side, pass: false })
}

// Rules v17: once both neutral cards are revealed, each player whose card has options (Read: draw or
// take from the table; Charge: meter or fetch from the discard) chooses, in initiative order.
const needsOption = (m, k) => m.acts[k]?.kind === 'neutral' && neutralModes16(P(m, k), m.acts[k].i, m.G.rules).length > 1
function nextOption(m) {
  const [rng, state] = aiRng(m)
  let acts = m.acts.slice(), optDone = m.optDone.slice()
  for (const k of initOrder(m.G)) {
    if (optDone[k]) continue
    if (!needsOption({ ...m, acts }, k)) { optDone[k] = true; continue }
    if (isHuman(m, k)) return handTo({ ...m, acts, optDone, aiRng: state(), phase: 'option' }, k)
    const opt = BOTS16[m.levels[k]] ? undefined : chooseMode16(m.G, k, acts, m.W, rng)
    acts[k] = { ...acts[k], opt }; optDone[k] = true
  }
  return applyNeutral({ ...m, acts, optDone, aiRng: state() })
}

export function chooseOption(m, side, opt) {
  const acts = m.acts.slice(); acts[side] = { ...acts[side], opt: opt === 'base' ? undefined : opt }
  const optDone = m.optDone.slice(); optDone[side] = true
  const decisions = { ...m.decisions, options: [...(m.decisions.options || []), { side, opt }] }
  return nextOption({ ...m, acts, optDone, decisions, lastChooser: side, pass: false })
}

// The options a player's revealed neutral card offers, with labels
export function optionList(m, side) {
  const X = P(m, side), a = m.acts[side]
  return neutralModes16(X, a.i, m.G.rules).map(opt => {
    const c = X.f.cards[a.i]
    if (opt === 'base') return { opt, label: c.now?.draw ? `Draw ${c.now.draw === 1 ? 'a clash card' : `${c.now.draw} clash cards`}` : c.now?.meter ? `Gain ${c.now.meter} meter` : 'Its printed effect' }
    if (opt.take !== undefined) return { opt, label: `Take ${opt.take === 'S' ? X.f.sup.name : X.f.cards[opt.take].name} from the table (${tableCost(X, opt.take)} meter)`, card: opt.take === 'S' ? X.f.sup : X.f.cards[opt.take], sup: opt.take === 'S' }
    return { opt, label: `Put ${X.f.cards[opt.fetch].name} from your discard pile into your hand`, card: X.f.cards[opt.fetch] }
  })
}

function applyNeutral(m) {
  const G = applyNeutral16(m.G, m.acts)
  return settleConfiscates({ ...m, G, turn: null }, 'clash')
}

// ---- Confiscate (the Warden) ----------------------------------------------------------
// Cards owed to a Confiscate are paid before the clash (Shakedown) or once the clash is
// over (an On hit Confiscate or Chain Prison). Each victim picks what goes; a sparring
// partner picks at once. then: 'clash' (go on to the clash) or 'finish' (record the round).
function settleConfiscates(m, then) {
  if (m.G.result !== null) return then === 'clash' ? beginClash(m) : finishClash(m)
  const [rng, state] = aiRng(m)
  let G = m.G
  const confiscated = m.confiscated.map(a => a.slice()), confPre = m.confPre.slice()
  for (const k of initOrder(G)) {
    const X = k === 0 ? G.A : G.B
    if (!X.owe || isHuman(m, k)) continue
    const cards = chooseConfiscate(G, k, X.owe, m.W, rng, m.levels[k], G.rules.confiscateBy || 'victim', m.levels[1 - k])
    confiscated[k].push(...cards.map(i => X.f.cards[i].name))
    if (then === 'clash') confPre[k] += cards.length
    G = confiscate16(G, k, cards)
  }
  m = { ...m, G, confiscated, confPre, aiRng: state() }
  const k = initOrder(m.G).find(s => P(m, s).owe)
  if (k !== undefined) return handTo({ ...m, phase: 'confiscate', confNext: then }, k)
  m = { ...m, confNext: null }
  return then === 'clash' ? beginClash(m) : finishClash(m)
}

export function chooseConfiscated(m, side, cards) {
  const X = P(m, side)
  const G = confiscate16(m.G, side, cards)
  const confiscated = m.confiscated.map(a => a.slice()), confPre = m.confPre.slice()
  confiscated[side].push(...cards.map(i => X.f.cards[i].name))
  if (m.confNext === 'clash') confPre[side] += cards.length
  const decisions = { ...m.decisions, confiscated: [...(m.decisions.confiscated || []), { side, cards }] }
  return settleConfiscates({ ...m, G, confiscated, confPre, decisions, lastChooser: side, pass: false }, m.confNext)
}

// What took the cards a player owes: the opponent's Shakedown, or the cards that hit them
export function confiscateSource(m, side) {
  if (m.confNext === 'clash') return m.G.neutral?.[1 - side]?.name || 'a neutral card'
  const from = (m.G.clash?.events || []).filter(e => e.kind === 'confiscate' && e.side === side).map(e => e.from)
  return [...new Set(from)].join(' and ') || 'a hit'
}

// ---- 2. clash ----------------------------------------------------------------------
function beginClash(m) {
  const [rng, state] = aiRng(m)
  const picks = [undefined, undefined]
  const aiMix = [null, null]
  for (const k of [0, 1]) {
    const X = P(m, k)
    if (!clashOptions16(X, m.G.rules).length) { picks[k] = null; continue }
    if (isHuman(m, k)) continue
    if (BOTS16[m.levels[k]]) picks[k] = botClash(m.G, k, m.levels[k], rng)
    else {
      const mix = clashMix16(m.G, k, m.W, rng, m.levels[k])
      picks[k] = mix.options[sampleIndex(mix.x, rng)]
      aiMix[k] = mix.options.map((o, i) => [o === null ? 'nothing' : card16(X, o).name, Math.round(mix.x[i] * 100) / 100])
    }
  }
  return nextPick({ ...m, phase: 'clash', picks, aiMix, aiRng: state() })
}

function nextPick(m) {
  const k = [0, 1].find(s => m.picks[s] === undefined)
  if (k === undefined) return resolve(m)
  return handTo({ ...m, phase: 'clash' }, k)
}

export function choosePick(m, side, pick) {
  const picks = m.picks.slice(); picks[side] = pick
  const decisions = { ...m.decisions, picks: Object.assign(m.decisions.picks.slice(), { [side]: pick }) }
  return nextPick({ ...m, picks, decisions, lastChooser: side, pass: false })
}

function resolve(m) {
  const G = startClash16(m.G, m.picks[0], m.picks[1])
  return continueClash({ ...m, G, neutralShown: m.G.neutral })
}

function continueClash(m) {
  let G = m.G
  while (G.pending && !isHuman(m, G.pending.side)) G = decideClash16(G, bestChoice16(G, G.pending, m.W))
  m = { ...m, G }
  if (G.pending) return handTo({ ...m, phase: 'stage' }, G.pending.side)
  return settleConfiscates(m, 'finish')
}

export function chooseStage(m, choice) {
  const { stage, side } = m.G.pending
  const G = decideClash16(m.G, choice)
  const decisions = { ...m.decisions, stages: [...m.decisions.stages, { side, stage, choice }] }
  return continueClash({ ...m, G, decisions, lastChooser: side, pass: false })
}

function finishClash(m) {
  const record = roundRecord16(m.G.round, m.roundBefore, m.G, m.G.neutral)
  const entry = { ...record, humans: m.humans, ...(m.aiMix.some(Boolean) ? { mix: m.aiMix } : {}), decisions: m.decisions,
    confiscated: m.confiscated, confPre: m.confPre }
  const last = { neutral: m.G.neutral, clash: m.G.clash, before: m.roundBefore, after: [snap16(m.G.A), snap16(m.G.B)] }
  if (m.G.result !== null) return { ...m, history: [...m.history, entry], last, result: m.G.result, phase: 'over', turn: null, pass: false }
  return { ...m, history: [...m.history, entry], last, phase: 'reveal', turn: null, pass: false }
}

// ---- 3. draw ----------------------------------------------------------------------
export function nextRound16(m) {
  let G = startDraw16(m.G)
  // In initiative order: a person discards before a later partner chooses (both choices are public)
  m = { ...m, G, last: null }
  return nextDiscard(m)
}

function nextDiscard(m) {
  let G = m.G
  for (const k of initOrder(G)) {
    if (G.phase !== 'draw' || !G.discardDown?.[k]) continue
    if (isHuman(m, k)) return handTo({ ...m, G, phase: 'discard' }, k)
    G = discardDown16(G, k, chooseDiscards(k === 0 ? G.A : G.B, G.discardDown[k]))
  }
  m = { ...m, G }
  if (G.phase === 'draw') return handTo({ ...m, phase: 'discard' }, G.discardDown[0] ? 0 : 1)
  return afterDraw(m)
}

export function chooseDiscard(m, side, cards) {
  const G = discardDown16(m.G, side, cards)
  const decisions = { ...m.decisions, discards: Object.assign(m.decisions.discards.slice(), { [side]: cards }) }
  m = { ...m, G, decisions, lastChooser: side, pass: false }
  if (G.phase === 'draw') return nextDiscard(m)
  return afterDraw(m)
}

function afterDraw(m) {
  if (m.G.result !== null) return { ...m, result: m.G.result, phase: 'over', turn: null }
  return beginNeutral(m)
}

export const continueAfterPass = m => ({ ...m, pass: false })

// ---- what the table shows ----------------------------------------------------------
// A player's hand, grouped: [{ i, c, n, ok, why }]
export function handGroups(X, okSet = null, why = null, cards = X.hand) {
  const counts = new Map()
  for (const i of cards) counts.set(i, (counts.get(i) || 0) + 1)
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => {
    const c = X.f.cards[i]
    const ok = okSet ? okSet.has(i) : true
    return { i, c, n, ok, why: ok ? null : (why ? why(c) : null) }
  })
}

// Why a card can't be played as the clash card
export function clashWhy(X) {
  return c => {
    if (c.t === 'N') return 'Neutral: play it in the neutral phase'
    if (X.st.lock?.[c.t]) return `Locked: voided if played`
    return 'Unavailable'
  }
}

export const clashSet = (m, side) => new Set(clashOptions16(P(m, side), m.G.rules))

// A few plain lines for the player about to pick. Hands are hidden, so they're
// about what the opponent *could* hold: the cards they haven't shown.
export function boardNotes16(m, side) {
  const X = P(m, side), Y = P(m, 1 - side), name = Y.f.name
  const notes = []
  const unseen = unseenCounts(Y)
  const could = pred => Y.f.cards.reduce((s, c, i) => s + (pred(c) ? unseen[i] : 0), 0)
  const pool = unseenPool(Y).length
  // what they might hit you with
  let bestC = null
  Y.f.cards.forEach((c, i) => { if (c.t === 'C' && unseen[i] && !Y.st.lock?.C) { const v = c.chip + (Y.fx.convertChip || 0) + (Y.fx.attackChip || 0); if (bestC === null || v > bestC.v) bestC = { v, c } } })
  if (superReady(Y, m.G.rules) && Y.f.sup.t === 'C' && !Y.st.lock?.C) { const v = Y.f.sup.chip + (Y.fx.convertChip || 0); if (!bestC || v > bestC.v) bestC = { v, c: Y.f.sup } }
  if (bestC && X.pile + bestC.v >= X.hp) notes.push({ tone: 'bad', text: `You're in lethal range if they hold ${bestC.c.name}: your ${X.pile} grey plus its ${bestC.v} chip is at least your ${X.hp} HP.` })
  if (superReady(Y, m.G.rules)) notes.push({ tone: 'bad', text: `${name} has ${Y.meter} meter: their Super, ${Y.f.sup.name}, is live.` })
  if (superReady(X, m.G.rules)) notes.push({ tone: 'good', text: `You have ${X.meter} meter: your Super, ${X.f.sup.name}, is live (it's in your hand row).` })
  if (m.G.rules.initiative && (m.G.init === 0 || m.G.init === 1)) notes.push({ tone: m.G.init === side ? 'good' : undefined, text: m.G.init === side ? 'You hold the initiative: you win speed ties this round, and choose first where there\'s an order.' : `${name} holds the initiative: they win speed ties this round.` })
  if (Y.superAt === 'hand') notes.push({ tone: 'bad', text: `${name} has taken their Super, ${Y.f.sup.name}, into their hand: it's live until they use it.` })
  // statuses this round
  for (const [who, Z, tone] of [['You', X, 'bad'], [name, Y, 'good']]) {
    const s = statusList(Z.st)
    if (s.length) notes.push({ tone, text: `${who} ${who === 'You' ? 'are' : 'is'} ${s.join(', ')} this round.` })
  }
  // their neutral card
  if (Y.inPlay != null) {
    const c = Y.f.cards[Y.inPlay]
    notes.push({ tone: c.capHand ? 'bad' : undefined, text: `${name} has ${c.name} in play: ${c.capHand ? `your clash hand limit is ${handLimitOf(X, Y, m.G.rules)} (you discard down to it in the draw step) until one of your Pressures hits them` : c.prevent === 'knockdown' ? 'the next knockdown on them is stopped' : 'it stays until used'}.` })
  }
  if (X.inPlay != null && X.f.cards[X.inPlay].capHand) notes.push({ tone: 'good', text: `Your ${X.f.cards[X.inPlay].name}: ${name}'s clash hand limit is ${handLimitOf(Y, X, m.G.rules)} until one of their Pressures hits you.` })
  if (Y.fx && Object.keys(Y.fx).length) notes.push({ text: `${name}'s neutral card is live: ${Object.entries(Y.fx).map(([k, v]) => ({ convertChip: `Converts chip +${v}`, pressureBuild: `Pressures build +${v}`, pressureChip: `Pressures chip +${v}`, attackChip: `attacks chip +${v}`, speed: `attacks +${v} speed`, grabConfiscate: 'their Grabs Confiscate on hit', armor: 'Armor: their Converts (not their Super) also beat Pressures', mixup: 'Mix-Up: their Pressures (not their Super) also beat Guards', parry: "Parry: if their Guard beats a Pressure, the punish can be any attack, and it can combo" })[k]).join(', ')}.` })
  // Counters
  const counters = could(c => c.counter)
  notes.push({ text: `${name} holds ${Y.hand.length} card${Y.hand.length === 1 ? '' : 's'}, from ${pool} you haven't seen: ${counters} of those are Counters. If you Pressure into their Guard, they punish only with a Counter.` })
  // speed duels
  for (const t of ['P', 'C']) {
    const mine = X.hand.map(i => X.f.cards[i]).filter(c => c.t === t)
    const theirs = Y.f.cards.filter((c, i) => c.t === t && unseen[i])
    if (!mine.length || !theirs.length || X.st.lock?.[t]) continue
    const myBest = Math.max(...mine.map(c => speedOf(X, c)))
    const theirBest = Math.max(...theirs.map(c => speedOf(Y, c)))
    const label = t === 'P' ? 'Pressure' : 'Convert'
    if (myBest > theirBest) notes.push({ text: `${label} duel: your fastest (${myBest}) beats anything they could hold (${theirBest} at most).` })
    else if (myBest < theirBest) notes.push({ text: `${label} duel: they could hold a faster one (${theirBest}) than your fastest (${myBest}).` })
    else notes.push({ text: `${label} duel: your fastest and theirs could both be ${myBest}: a tie ${m.G.rules.speedTie === 'lowhp' ? 'goes to the player on less HP' : 'cancels'}.` })
  }
  if (Y.pile > 0) notes.push({ tone: 'good', text: `A Convert that beats ${name} cashes their ${Y.pile} grey, plus its chip.` })
  return notes
}

// ---- the log entry -----------------------------------------------------------------
export function gameRecord16(m) {
  const last = m.history[m.history.length - 1]
  return {
    id: m.id, v: 3, rules: 16,
    startedAt: m.startedAt, finishedAt: Date.now(),
    mode: m.mode, humans: m.humans, levels: m.levels,
    fighters: m.json.map((j, k) => ({ id: j.id, name: j.name, hash: fighterHash16(j), status: m.statuses[k], json: j })),
    settings: m.settingsUsed, seed: m.seed,
    result: m.result, route: last ? winRoute16(last, m.result) : null,
    rounds: m.history.map(({ humans, ...r }) => r),
    final: [snap16(m.G.A), snap16(m.G.B)],
  }
}

export const snapshot16 = m => JSON.parse(JSON.stringify(m))
export { LEVELS16, BOTS16, STATUSES }
