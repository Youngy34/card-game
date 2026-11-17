// Render smoke test for the v23 page (edition data/v23d), without Preact (tools/smoke/mini-preact.mjs stands in):
// plays hot-seat and partner games through the match logic and renders the setup screen and the table at every
// step, checking nothing throws and v23 shows: range endings on cards, the Overdrive and exchange options, the
// Overdrive flag, Guard draws, and the v23 lede.
//   node tools/smoke/render23.mjs

import fs from 'fs'
import * as MP from './mini-preact.mjs'

globalThis.preact = { h: MP.h, render: MP.render, Fragment: MP.Fragment }
globalThis.preactHooks = MP.hooks
globalThis.htm = MP.htm
const mem = {}
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v) }, removeItem: k => { delete mem[k] } }
globalThis.location = { search: '?edition=v23' }

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../../data/v23d/settings.json')
const J = { brawler: read('../../data/v23d/brawler.json'), zoner: read('../../data/v23d/zoner.json') }
const { useHeatWords } = await import('../../src/engine/v16/cards.js')
useHeatWords(S.rules)
const M = await import('../../src/app/v16/match16.js')
const P16 = await import('../../src/app/v16/play16.js')
const { Card16 } = await import('../../src/app/v16/card16.js')

let fails = 0, passes = 0
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL:', msg) } }
const seen = { token: 0, reach: 0, why: 0, move: 0, od: 0, odFlag: 0, odHit: 0, exPick: 0, exDone: 0, odLog: 0, drew: 0, moved: 0, setup: 0, ends: 0 }

// Card faces: reach and range endings
{
  const face = n => MP.renderText(MP.h(Card16, { card: [...J.brawler.cards, ...J.zoner.cards].find(c => c.name === n) }))
  ok(face('Dash Punch').includes('Hit or blocked: the fight ends at Close'), 'Dash Punch shows its ending (hit or blocked)')
  ok(face('Haymaker').includes('On hit: the fight ends at Far'), 'Haymaker shows its on-hit ending')
  const dk = face('Dive Kick')
  ok(dk.includes('On hit: the fight ends at Far') && dk.includes("If it's Guarded: the fight ends at Close"), 'Dive Kick shows both endings')
  ok(face('Stand Firm').includes("doesn't move the fight"), 'Stand Firm shows its line')
  ok(face('Evade').includes('build 1 Charge'), 'Evade shows its line')
  ok(/Close or Far/.test(face('Body Slam')), 'Body Slam reaches both')
}

for (const mode of ['hotseat', 'ai']) for (let s = 0; s < 6; s++) {
  let m = M.startMatch16({ fighters: s % 2 ? [J.zoner, J.brawler] : [J.brawler, J.zoner], mode, settings: S, seed: 700 + s, id: `${mode}${s}` })
  let guard = 0, err = null
  const draw = () => {
    try {
      const t = MP.renderText(MP.h(P16.Table16, { m, setM: () => {}, prefs: { hints: true }, onEnd: () => {} }))
      if (/\bFar\b|\bClose\b/.test(t) && t.includes('range')) seen.token++
      if (t.includes('Close or Far')) seen.reach++
      if (t.includes('Out of reach')) seen.why++
      if (t.includes('Move the fight to')) seen.move++
      if (/Overdrive for \d|Stay in Overdrive for \d/.test(t)) seen.od++
      if (t.includes('In Overdrive this round') || /\bOverdrive\b/.test(t) && m.G.A.od || m.G.B.od) seen.odFlag++
      if (t.includes('lands in Overdrive')) seen.odHit++
      if (t.includes('The exchange: pick a card to give')) seen.exPick++
      if (/swapped .+ for /.test(t)) seen.exDone++
      if (/went into Overdrive|stayed in Overdrive/.test(t)) seen.odLog++
      if (t.includes('draws a card')) seen.drew++
      if (t.includes('The fight moves to')) seen.moved++
      if (t.includes('the fight ends at')) seen.ends++
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
    else if (m.phase === 'buy') {
      const list = M.buyList(m, side), r = (m.G.round + side + s) % 4
      ok(list.every(o => typeof o.label === 'string' && !o.label.includes('undefined')), `every end-of-round option has a label (round ${m.G.round})`)
      const pick = (r === 0 && list.find(o => o.od)) || (r === 1 && list.find(o => o.exchange)) || (r === 2 && list.find(o => o.move)) || list[0]
      m = M.chooseBuy(m, side, pick.opt)
    }
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
  store.initData({ fighters: { brawler23b: J.brawler, zoner23b: J.zoner }, order: ['brawler23b', 'zoner23b'], reference: [], drafts: ['brawler23b', 'zoner23b'], settings: S,
    edition: { key: 'v23', title: 'Guardbreakers Playtest v23', subtitle: '', labels: {}, defaultSides: ['brawler23b', 'zoner23b'] } })
  const t = MP.renderText(MP.h(P16.Setup16, { onStart: () => {}, prefs: { sides: ['brawler23b', 'zoner23b'], mode: 'ai', difficulty: 'hard' }, setPrefs: () => {} }))
  if (t.includes('Rules v23') && t.includes('Overdrive') && t.includes('the exchange') && t.includes('on hit, and on block')) seen.setup++
  ok(!/special|Super/.test(t.replace(/Guardbreakers/g, '')), 'setup says nothing of specials or the Super')
  ok(true, 'setup renders')
} catch (e) { ok(false, 'setup renders: ' + e.stack.split('\n').slice(0, 3).join(' | ')) }
console.log(seen)
ok(seen.token > 50, `the range token shows (${seen.token})`)
ok(seen.reach > 20, `reach shows on cards (${seen.reach})`)
ok(seen.ends > 20, `range endings show on cards (${seen.ends})`)
ok(seen.move > 0, `the move option shows (${seen.move})`)
ok(seen.od > 0, `the Overdrive option shows (${seen.od})`)
ok(seen.odHit > 0, `a hit in Overdrive says so (${seen.odHit})`)
ok(seen.exPick > 0, `the exchange picker shows (${seen.exPick})`)
ok(seen.exDone > 0, `the log says what was exchanged (${seen.exDone})`)
ok(seen.odLog > 0, `the log says who went into Overdrive (${seen.odLog})`)
ok(seen.drew > 0, `Guard draws are narrated (${seen.drew})`)
ok(seen.moved > 0, `the result says when the fight moved (${seen.moved})`)
ok(seen.setup > 0, `the setup text explains v23 (${seen.setup})`)
console.log(`${passes}/${passes + fails} pass`)
if (fails) process.exit(1)
