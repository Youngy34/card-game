// Render smoke test for the v23 page as of 17 Nov (edition key v23tp, data/v23tp2), without Preact
// (tools/smoke/mini-preact.mjs stands in): plays hot-seat, partner and watched games through the match logic and
// renders the setup screen and the table at every step, checking nothing throws and the 17 November rules show:
// the abilities (Clinch, Zone), the knockdown (no end-of-round option), EX Overdrive (the sideways fighter card, winning
// speed clashes), charge up, Guard range lines, no exchange, and the time-out penalty.
//   node tools/smoke/render23tp.mjs

import fs from 'fs'
import * as MP from './mini-preact.mjs'

globalThis.preact = { h: MP.h, render: MP.render, Fragment: MP.Fragment }
globalThis.preactHooks = MP.hooks
globalThis.htm = MP.htm
const mem = {}
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v) }, removeItem: k => { delete mem[k] } }
globalThis.location = { search: '?edition=v23tp' }

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../../data/v23tp2/settings.json')
const J = { brawler: read('../../data/v23tp2/brawler.json'), zoner: read('../../data/v23tp2/zoner.json') }
const { useHeatWords } = await import('../../src/engine/v16/cards.js')
useHeatWords(S.rules)
const M = await import('../../src/app/v16/match16.js')
const P16 = await import('../../src/app/v16/play16.js')
const { Card16 } = await import('../../src/app/v16/card16.js')

let fails = 0, passes = 0
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL:', msg) } }
const seen = { ability: 0, clinchNote: 0, clinchHit: 0, kdFlag: 0, kdText: 0, kdSkip: 0, odCard: 0, odFast: 0, odNote: 0, upPick: 0, upLog: 0,
  zonePick: 0, zoneFlag: 0, zoneHidden: 0, zoneOwn: 0, zoneNote: 0, zoneHit: 0, guardTo: 0, penaltyNote: 0, penaltyEnd: 0, togetherEnd: 0, exchange: 0, timeouts: 0 }

// Card faces: the Guards' range lines
{
  const face = n => MP.renderText(MP.h(Card16, { card: [...J.brawler.cards, ...J.zoner.cards].find(c => c.name === n) }))
  ok(face('Step In').includes('the fight ends at Close'), 'Step In shows its range line')
  ok(face('Sidestep').includes('the fight ends at Far'), 'Sidestep shows its range line')
  ok(face('Catch').includes('any Pressure'), 'Catch shows its line')
  ok(/Close or Far/.test(face('Body Slam')), 'Body Slam reaches both')
}

const games = []
for (const mode of ['hotseat', 'ai', 'watch']) for (let s = 0; s < 8; s++) games.push([mode, s])
for (const [mode, s] of games) {
  let m = M.startMatch16({ fighters: s % 2 ? [J.zoner, J.brawler] : [J.brawler, J.zoner], mode, settings: S, seed: 900 + s, id: `${mode}${s}` })
  let guard = 0, err = null
  const draw = () => {
    try {
      const t = MP.renderText(MP.h(P16.Table16, { m, setM: () => {}, prefs: { hints: true, showHands: false }, onEnd: () => {} }))
      if (t.includes('Clinch: if your Guard beats a Pressure at Close') && t.includes('Zone: as your end-of-round option')) seen.ability++
      if (/Clinch: at Close, if .*Guard beats/.test(t)) seen.clinchNote++
      if (t.includes('drags') && t.includes('knocked down')) seen.clinchHit++
      if (t.includes('Knocked down</span>') || /Knocked down(?!:)/.test(t) && (m.G.A.next?.knockdown || m.G.B.next?.knockdown)) seen.kdFlag++
      if (t.includes('no end-of-round option this round')) seen.kdText++
      if (t.includes('Fighter card turned sideways')) seen.odCard++
      if (t.includes('is in Overdrive, so they win every speed clash')) seen.odFast++
      if (t.includes("You're in Overdrive (fighter card sideways)") || t.includes('is in Overdrive: each of their attacks')) seen.odNote++
      if (t.includes('Charge up: discard an attack for its Charge')) seen.upPick++
      if (/charged up: discarded .+ for \+\d/.test(t)) seen.upLog++
      if (t.includes('Zone: set a Pressure face down')) seen.zonePick++
      if (t.includes('Zone set') || /Zone: [A-Z][a-z]+ /.test(t)) seen.zoneFlag++
      if (t.includes('set a zone: a Pressure face down')) seen.zoneHidden++
      if (/Your zone \(.+\) is set until the end of round/.test(t)) seen.zoneOwn++
      if (/zone is set until the end of round \d+ \(a Pressure face down\)/.test(t)) seen.zoneNote++
      if (t.includes('zone goes off') || t.includes('zone went off')) seen.zoneHit++
      if (t.includes("a Guard's own range line wins over the Pressure's")) seen.guardTo++
      if (t.includes("each Guard that draws takes one more")) seen.penaltyNote++
      if (/deck ran out first: −3 HP/.test(t)) seen.penaltyEnd++
      if (t.includes('Both decks ran out together')) seen.togetherEnd++
      if (/exchange/i.test(t)) seen.exchange++
      if (t.includes('undefined') || t.includes('NaN')) throw new Error(`"undefined" or "NaN" on the table (phase ${m.phase}, round ${m.G.round})`)
    } catch (e) { err = e }
  }
  while (m.phase !== 'over' && guard++ < 3000 && !err) {
    draw()
    if (err) break
    if (m.pass) { m = M.continueAfterPass(m); continue }
    const side = m.turn
    if (m.phase === 'clash') { const o = [...M.clashSet(m, side)]; m = M.choosePick(m, side, o.length ? o[(s + m.G.round * 3 + side) % o.length] : null) }
    else if (m.phase === 'stage') { const so = M.stageOptions(m), all = [...so.link, ...so.end]; m = all.length && m.G.round % 2 ? M.chooseStageCard(m, all[0]) : (m.G.pending.stage === 'link' ? M.stopCombo(m) : M.chooseStage(m, null)) }
    else if (m.phase === 'buy') {
      const X = side === 0 ? m.G.A : m.G.B
      ok(!(m.G.rules.knockdownNoOption && X.next?.knockdown), `a knocked-down player isn't asked for an option (round ${m.G.round})`)
      const list = M.buyList(m, side), r = (m.G.round + side + s) % 5
      ok(list.every(o => typeof o.label === 'string' && !o.label.includes('undefined')), `every end-of-round option has a label (round ${m.G.round})`)
      ok(!list.some(o => o.exchange), 'no exchange on offer')
      const pick = (r === 0 && list.find(o => o.od)) || (r === 1 && list.find(o => o.chargeUp)) || (r === 2 && list.find(o => o.move)) || ((r === 3 || r === 4) && list.find(o => o.zone)) || list[0]
      m = M.chooseBuy(m, side, pick.opt)
      draw()
    }
    else if (m.phase === 'discard') { const X = side === 0 ? m.G.A : m.G.B; m = M.chooseDiscard(m, side, X.hand.slice(0, m.G.discardDown[side])) }
    else if (m.phase === 'reveal') {
      // a knocked-down human is skipped at the end of the round
      for (const k of [0, 1]) if (m.humans[k] && (k === 0 ? m.G.A : m.G.B).next?.knockdown) seen.kdSkip++
      m = M.nextRound16(m)
    }
    else { ok(false, `unexpected phase ${m.phase}`); break }
  }
  if (!err) draw()
  if (m.timedOut) seen.timeouts++
  ok(!err, `${mode} game ${s} renders at every step${err ? ': ' + err.stack.split('\n').slice(0, 4).join(' | ') : ''}`)
  ok(m.phase === 'over', `${mode} game ${s} finishes (round ${m.G.round})`)
  if (m.phase === 'over') { const rec = M.gameRecord16(m); ok(rec.rounds.length > 0 && (!m.G.deckPenalty || rec.deckPenalty), `${mode} game ${s}: the log record keeps the time-out penalty`) }
}
// A time-out with the penalty, forced: decks emptied near the end
{
  let m = M.startMatch16({ fighters: [J.brawler, J.zoner], mode: 'watch', settings: S, seed: 4242, id: 'to' })
  m = { ...m, G: { ...m.G, A: { ...m.G.A, deck: m.G.A.deck.slice(0, 1) }, B: { ...m.G.B, deck: m.G.B.deck.slice(0, 4) } } }
  let guard = 0
  while (m.phase !== 'over' && guard++ < 200) {
    if (m.phase === 'reveal') m = M.nextRound16(m)
    else break
  }
  const t = MP.renderText(MP.h(P16.Table16, { m, setM: () => {}, prefs: { hints: true }, onEnd: () => {} }))
  ok(m.phase === 'over' && (m.timedOut || m.result !== null), `the forced game ends (${m.phase}, timed out ${!!m.timedOut})`)
  if (m.timedOut) ok(/deck ran out first: −3 HP/.test(t), 'the end screen names who ran out first and the 3 HP')
}
try {
  const store = await import('../../src/app/store.js')
  store.initData({ fighters: { 'brawler-t': J.brawler, 'zoner-t': J.zoner }, order: ['brawler-t', 'zoner-t'], reference: [], drafts: ['brawler-t', 'zoner-t'], settings: S,
    edition: { key: 'v23tp', title: 'Guardbreakers Playtest v23 (17 Nov)', subtitle: '', labels: {}, defaultSides: ['brawler-t', 'zoner-t'] } })
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const t = MP.renderText(MP.h(P16.Setup16, { onStart: () => {}, prefs: { sides: ['brawler-t', 'zoner-t'], mode: 'ai', difficulty }, setPrefs: () => {} }))
    ok(t.includes('Rules v23 (17 November)') && t.includes('turn your fighter card sideways') && t.includes('charge up') && t.includes('loses 3 HP') && t.includes('lose every speed clash in your next clash') && !t.includes('the exchange'), `the setup text explains the 17 Nov rules (${difficulty})`)
    ok(t.includes('Clinch') && t.includes('Zone'), `the fighter picker names the abilities (${difficulty})`)
    ok(!t.includes('Benchmark') && !t.includes('undefined'), `the difficulty text is for these fighters (${difficulty})`)
  }
  const { Settings16 } = await import('../../src/app/v16/settings16.js')
  const st = MP.renderText(MP.h(Settings16, {}))
  ok(st.includes('loses (HP)') && st.includes('Charge up') && st.includes('Knocked down') && st.includes('In Overdrive'), 'Settings shows the 17 Nov dials')
} catch (e) { ok(false, 'setup and settings render: ' + e.stack.split('\n').slice(0, 3).join(' | ')) }
console.log(seen)
ok(seen.ability > 50, `the fighter cards' abilities show (${seen.ability})`)
ok(seen.clinchNote > 0, `the Clinch board note shows at Close (${seen.clinchNote})`)
ok(seen.clinchHit > 0, `a Clinch knockdown is narrated (${seen.clinchHit})`)
ok(seen.kdText > 0, `the knockdown text says no end-of-round option (${seen.kdText})`)
ok(seen.kdFlag > 0, `the HUD flags a knockdown (${seen.kdFlag})`)
ok(seen.odCard > 0, `the fighter card turns sideways in Overdrive (${seen.odCard})`)
ok(seen.odFast > 0, `Overdrive winning a speed clash is explained (${seen.odFast})`)
ok(seen.odNote > 0, `the Overdrive board note shows (${seen.odNote})`)
ok(seen.upPick > 0, `the charge-up picker shows (${seen.upPick})`)
ok(seen.upLog > 0, `the log says what was charged up (${seen.upLog})`)
ok(seen.zonePick > 0, `the Zone picker shows (${seen.zonePick})`)
ok(seen.zoneFlag > 0, `the HUD shows a set zone (${seen.zoneFlag})`)
ok(seen.zoneHidden > 0, `the log hides the zone's card from the opponent (${seen.zoneHidden})`)
ok(seen.zoneOwn > 0 && seen.zoneNote > 0, `board notes cover your zone and theirs (${seen.zoneOwn}, ${seen.zoneNote})`)
ok(seen.zoneHit > 0, `a zone going off is narrated (${seen.zoneHit})`)
ok(seen.guardTo > 0, `a Guard's range line is narrated (${seen.guardTo})`)
ok(seen.penaltyNote > 0, `the time-out note explains the penalty (${seen.penaltyNote})`)
ok(seen.exchange === 0, `nothing mentions the exchange (${seen.exchange})`)
console.log(`${passes}/${passes + fails} pass`)
if (fails) process.exit(1)
