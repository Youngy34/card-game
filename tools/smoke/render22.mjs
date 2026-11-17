// Render smoke test for the v22 page's table, without Preact (tools/smoke/mini-preact.mjs stands in): plays
// hot-seat and partner games through the match logic and renders the setup screen and the table at every step,
// checking nothing throws and the range shows (the token, reach on cards, out-of-reach reasons, the move option).
//   node tools/smoke/render22.mjs

import fs from 'fs'
import * as MP from './mini-preact.mjs'

globalThis.preact = { h: MP.h, render: MP.render, Fragment: MP.Fragment }
globalThis.preactHooks = MP.hooks
globalThis.htm = MP.htm
const mem = {}
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v) }, removeItem: k => { delete mem[k] } }
globalThis.location = { search: '?edition=v22' }

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../../data/v22/settings.json')
const J = { brawler: read('../../data/v22/brawler.json'), zoner: read('../../data/v22/zoner.json') }
const { useHeatWords } = await import('../../src/engine/v16/cards.js')
useHeatWords(S.rules)
const M = await import('../../src/app/v16/match16.js')
const P16 = await import('../../src/app/v16/play16.js')
const { Card16 } = await import('../../src/app/v16/card16.js')

let fails = 0, passes = 0
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL:', msg) } }
const seen = { token: 0, reach: 0, why: 0, move: 0, wants: 0, moved: 0, setup: 0, breakBuild: 0, guardStop: 0 }

// Card faces: reach chips and move text
{
  const t = MP.renderText(MP.h(Card16, { card: J.brawler.cards.find(c => c.name === 'Dash Punch') }))
  ok(t.includes('Close or Far') && t.includes('Moves the fight to Close'), 'Dash Punch shows its reach and its move')
  const s = MP.renderText(MP.h(Card16, { card: J.zoner.cards.find(c => c.name === 'Shot') }))
  ok(/\bFar\b/.test(s), 'Shot shows Far')
  const b = MP.renderText(MP.h(Card16, { card: J.zoner.cards.find(c => c.name === 'Backstep') }))
  ok(b.includes('the fight moves to Far'), 'Backstep says it moves the fight')
}

for (const mode of ['hotseat', 'ai']) for (let s = 0; s < 4; s++) {
  let m = M.startMatch16({ fighters: [J.brawler, J.zoner], mode, settings: S, seed: 500 + s, id: `${mode}${s}` })
  let guard = 0, err = null
  const draw = () => {
    try {
      const t = MP.renderText(MP.h(P16.Table16, { m, setM: () => {}, prefs: { hints: true }, onEnd: () => {} }))
      if (/\bFar\b|\bClose\b/.test(t) && t.includes('range')) seen.token++
      if (t.includes('Close or Far')) seen.reach++
      if (t.includes('Out of reach')) seen.why++
      if (t.includes('Move the fight to')) seen.move++
      if (t.includes('Wants Close') && t.includes('Wants Far')) seen.wants++
      if (t.includes('The fight moves to')) seen.moved++
      if (/smashes through: \w+ builds \d Charge/.test(t)) seen.breakBuild++
      if (t.includes('stops the attack')) seen.guardStop++
    } catch (e) { err = e }
  }
  while (m.phase !== 'over' && guard++ < 3000 && !err) {
    draw()
    if (err) break
    if (m.pass) { m = M.continueAfterPass(m); continue }
    const side = m.turn
    if (m.phase === 'clash') { const o = [...M.clashSet(m, side)]; m = M.choosePick(m, side, o.length ? o[(s + m.G.round) % o.length] : null) }
    else if (m.phase === 'rider') m = M.chooseRider(m, side, M.riderList(m, side)[0].opt)
    else if (m.phase === 'stage') { const so = M.stageOptions(m), all = [...so.link, ...so.end]; m = all.length && m.G.round % 2 ? M.chooseStageCard(m, all[0]) : (m.G.pending.stage === 'link' ? M.stopCombo(m) : M.chooseStage(m, null)) }
    else if (m.phase === 'confiscate') { const X = side === 0 ? m.G.A : m.G.B; m = M.chooseConfiscated(m, side, X.hand.slice(0, X.owe)) }
    else if (m.phase === 'buy') { const list = M.buyList(m, side), mv = list.find(o => o.move); m = M.chooseBuy(m, side, (mv && (m.G.round + side) % 2 ? mv : list.find(o => o.card) || list[0]).opt) }
    else if (m.phase === 'discard') { const X = side === 0 ? m.G.A : m.G.B; m = M.chooseDiscard(m, side, X.hand.slice(0, m.G.discardDown[side])) }
    else if (m.phase === 'reveal') m = M.nextRound16(m)
    else { ok(false, `unexpected phase ${m.phase}`); break }
  }
  if (!err) draw()
  ok(!err, `${mode} game ${s} renders at every step${err ? ': ' + err.stack.split('\n').slice(0, 4).join(' | ') : ''}`)
  ok(m.phase === 'over', `${mode} game ${s} finishes (round ${m.G.round})`)
}
try {
  const store = await import('../../src/app/store.js')
  store.initData({ fighters: { brawler22: J.brawler, zoner22: J.zoner }, order: ['brawler22', 'zoner22'], reference: [], drafts: ['brawler22', 'zoner22'], settings: S,
    edition: { key: 'v22', title: 'Guardbreakers Playtest v22', subtitle: '', labels: {}, defaultSides: ['brawler22', 'zoner22'] } })
  const t = MP.renderText(MP.h(P16.Setup16, { onStart: () => {}, prefs: { sides: ['brawler22', 'zoner22'], mode: 'ai', difficulty: 'hard' }, setPrefs: () => {} }))
  if (t.includes('Rules v22') && t.includes('Close, Far or both') && t.includes('only way to build Charge')) seen.setup++
  ok(true, 'setup renders')
} catch (e) { ok(false, 'setup renders: ' + e.stack.split('\n').slice(0, 3).join(' | ')) }
ok(seen.token > 50, `the range token shows (${seen.token})`)
ok(seen.reach > 20, `reach shows on cards (${seen.reach})`)
ok(seen.why > 0, `out-of-reach reasons show (${seen.why})`)
ok(seen.move > 0, `the move option shows at the end of a round (${seen.move})`)
ok(seen.wants > 20, `each side shows the range it wants (${seen.wants})`)
ok(seen.moved > 0, `the result says when the fight moved (${seen.moved})`)
ok(seen.setup > 0, `the setup text explains range and Charge (${seen.setup})`)
ok(seen.breakBuild > 0, `a Break that lands says it builds Charge (${seen.breakBuild})`)
ok(seen.guardStop > 0, `a Guard that wins says it stops the attack (${seen.guardStop})`)
console.log(`${passes}/${passes + fails} pass`)
if (fails) process.exit(1)
