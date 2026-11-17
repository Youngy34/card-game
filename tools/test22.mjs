// Rule checks for rules v22 (13 Nov): range. The initiative token shows Close or Far (the fight starts at Far).
// Attacks reach Close, Far or both, and can't be played out of reach; Guards reach anywhere. Cards that move the
// fight move it win or lose; two clash cards moving opposite ways cancel. The Zoner's Backstep moves the fight to Far
// if it beats a Pressure. At the end of a round a player may pay 3 Charge to move the fight instead of buying.
// Also drives whole hot-seat matches through the page's match logic (no rendering), answering every prompt.
//   node tools/test22.mjs

import fs from 'fs'
import { toFighter16, validateFighter16, cardLines16, useHeatWords, validateCard16 } from '../src/engine/v16/cards.js'
import { newGame16, startClash16, decideClash16, heatOf, clashOptions16, buyOptions20, applyBuy20, buy20, startDraw16 } from '../src/engine/v16/engine.js'
import { playGame18 } from '../src/engine/v16/game.js'
import { DEFAULT_W16 } from '../src/engine/v16/ai.js'
import { narrate16 } from '../src/app/v16/narrate16.js'

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)))
const S = read('../data/v22/settings.json')
const rules = { ...S.rules }, W = { ...DEFAULT_W16, ...S.ai }
useHeatWords(rules)
let fails = 0, passes = 0
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL:', msg) } }
const J = { brawler: read('../data/v22/brawler.json'), zoner: read('../data/v22/zoner.json') }

// 0. The decks and settings
for (const n of ['brawler', 'zoner']) {
  const f = J[n], v = validateFighter16(f)
  ok(!v.errors.length, `${n} validates ${JSON.stringify(v.errors)}`)
  ok(f.cards.filter(c => !c.special).reduce((s, c) => s + c.copies, 0) === 28, `${n}: 28 cards`)
  ok(f.cards.every(c => c.type === 'recover' || c.reach), `${n}: every attack has a reach`)
  ok(f.super?.reach, `${n}: the Super has a reach`)
}
ok(J.brawler.prefers === 'close' && J.zoner.prefers === 'far', 'the Brawler wants Close, the Zoner Far')
ok(rules.range && rules.rangeMode === 'cards' && rules.rangeDead && rules.rangeStart === 'far' && rules.chargeMove === 3, 'v22 settings: range by cards, dead cards, start Far, move for 3')
ok(!rules.sides && !rules.breakSpends && !rules.superLive, 'no two-sided card, no Break penalty, the Super is bought')
ok(['brawler', 'zoner'].every(k => J[k].cards.every(c => c.type === 'recover' || (c.chip ?? 0) >= 1)), 'attack budgets (14 Nov): every attack deals at least 1 damage')
ok(J.brawler.cards.find(c => c.name === 'Haymaker').chip === 4 && J.brawler.hp === 24 && J.zoner.hp === 16, 'Haymaker hits for 4; HP 24 / 16')
ok(rules.comboSameType === false, 'mixed combos (14 Nov): any Linker or Ender can follow any Starter')
ok(J.brawler.cards.find(c => c.name === 'Body Slam').build === 2 && J.zoner.cards.find(c => c.name === 'Charged Blast').build === 2, 'the Break Starters are cheap: Charge 2')
ok(rules.breakBuilds === 3 && rules.guardDrain === false && rules.greyPerRound === 0 && !rules.guardCost, 'Charge as a meter (14 Nov): Breaks build 3, Guards never drain and are free, no Charge at the end of the round')
ok(validateCard16({ name: 'X', type: 'pressure', kind: 'strike', speed: 12, build: 1, chip: 1, copies: 1, reach: 'middle' }).errors.length > 0, 'a bad reach is rejected')
ok(validateCard16({ name: 'X', type: 'pressure', kind: 'strike', speed: 12, build: 1, chip: 1, copies: 1, move: 'up' }).errors.length > 0, 'a bad move is rejected')

const BR = toFighter16(J.brawler), ZO = toFighter16(J.zoner)
const id = (f, n) => f.cards.findIndex(c => c.name === n)
const base = (patchA = {}, patchB = {}, range = 'far', init = 0) => {
  const G = newGame16(BR, ZO, rules, 5)
  return { ...G, init, range, A: { ...G.A, at: range, ...patchA }, B: { ...G.B, at: range, ...patchB } }
}
const [JAB, HOOK, DASH, HAY, THROW, SLAM, LEAP, RECALL, BLOCK] = ['Jab', 'Hook', 'Dash Punch', 'Haymaker', 'Throw', 'Body Slam', 'Leaping Slam', 'Recall', 'Step In'].map(n => id(BR, n))
const [POKE, SHOT, FADE, BLAST, ZTHROW, HOP, BACK] = ['Poke', 'Shot', 'Fade Shot', 'Charged Blast', 'Throw', 'Hop Kick', 'Backstep'].map(n => id(ZO, n))

// 1. A new game starts at Far, both players carrying the range
{
  const G = newGame16(BR, ZO, rules, 9)
  ok(G.range === 'far' && G.A.at === 'far' && G.B.at === 'far', 'the fight starts at Far')
}
// 2. Out of reach, a card can't be played
{
  const G = base({ hand: [JAB, HOOK, DASH, HAY, THROW, SLAM, LEAP, BLOCK] })
  const o = clashOptions16(G.A, G.rules).sort((a, b) => a - b)
  ok(JSON.stringify(o) === JSON.stringify([DASH, HAY, LEAP, BLOCK].sort((a, b) => a - b)), `the Brawler at Far: only Dash Punch, Haymaker, Leaping Slam and Guards (${o})`)
  const C = base({ hand: [JAB, HOOK, THROW] }, { hand: [SHOT, BLAST, POKE, ZTHROW] }, 'close')
  ok(JSON.stringify(clashOptions16(C.B, C.rules).sort((a, b) => a - b)) === JSON.stringify([POKE, ZTHROW].sort((a, b) => a - b)), 'the Zoner at Close: Shot and Charged Blast are dead')
  ok(clashOptions16(base({ hand: [JAB, HOOK] }).A, rules).length === 0, 'nothing in reach: no clash options')
}
// 3. A mover moves the fight even when it loses
{
  const G = startClash16(base({ hand: [DASH] }, { hand: [id(ZO, 'Read')] }), DASH, id(ZO, 'Read'))
  let g = G; while (g.pending) g = decideClash16(g, null)
  ok(g.clash.winner === 1 && g.range === 'close' && g.A.at === 'close' && g.B.at === 'close', `Dash Punch loses to a Guard but pulls the fight to Close (${g.range})`)
  ok(g.clash.events.some(e => e.kind === 'moved' && e.to === 'close'), 'a moved event is recorded')
  ok(narrate16(g.clash.events, ['Brawler', 'Zoner']).some(l => l.includes('moves to Close')), 'the narration says the fight moved')
}
// 4. Opposite moves cancel
{
  let g = startClash16(base({ hand: [DASH] }, { hand: [FADE] }), DASH, FADE)
  while (g.pending) g = decideClash16(g, null)
  ok(g.range === 'far' && g.clash.events.some(e => e.kind === 'moveCancel'), `Dash Punch v Fade Shot: they cancel and the fight stays at Far (${g.range})`)
}
// 5. A card that doesn't move leaves the range alone
{
  let g = startClash16(base({ hand: [HAY] }, { hand: [SHOT] }), HAY, SHOT)
  while (g.pending) g = decideClash16(g, null)
  ok(g.range === 'far', 'Haymaker v Shot: the fight stays at Far')
}
// 6. Backstep: if it beats a Pressure, the fight moves to Far; if it loses, nothing moves
{
  let g = startClash16(base({ hand: [JAB] }, { hand: [BACK] }, 'close'), JAB, BACK)
  while (g.pending) g = decideClash16(g, null)
  ok(g.clash.winner === 1 && g.range === 'far', `Backstep beats Jab: the fight moves to Far (${g.range})`)
  g = startClash16(base({ hand: [THROW] }, { hand: [BACK] }, 'close'), THROW, BACK)
  while (g.pending) g = decideClash16(g, null)
  ok(g.clash.winner === 0 && g.range === 'close', 'Backstep loses to Throw: the fight stays at Close')
}
// 7. A winner's follow-up or combo card that moves applies after the clash cards
{
  let g = startClash16(base({ hand: [DASH, LEAP] }, { hand: [SHOT] }), DASH, SHOT)
  ok(g.pending?.stage === 'link' || g.pending?.stage === 'end' || !g.pending, 'Dash Punch beats Shot on speed and may combo')
  while (g.pending) g = decideClash16(g, null)
  ok(g.range === 'close', 'Dash Punch wins: the fight is at Close')
}
// 8. Moving with Charge: 3 Charge, at the end of a round, instead of buying
{
  const G0 = base({}, {}, 'close')
  const G = { ...G0, A: { ...G0.A, pile: 0 }, B: { ...G0.B, pile: 4 } }      // the pile on B is A's Charge
  ok(heatOf(G, 0) === 4 && buyOptions20(G, 0).includes('M'), 'with 4 Charge, moving is an option')
  ok(!buyOptions20({ ...G, B: { ...G.B, pile: 2 } }, 0).includes('M'), 'with 2 Charge, it is not')
  const H = applyBuy20(G, 0, 'M')
  ok(H.range === 'far' && H.A.at === 'far' && H.B.at === 'far' && heatOf(H, 0) === 1, `moving costs 3 and switches the range (${H.range}, ${heatOf(H, 0)} left)`)
  ok(H.bought[0]?.move === 'far', 'the move is recorded as the round\'s purchase')
}
// 8b. Charge as a meter (14 Nov): a Break builds, a Guard leaves Charge alone, and the round adds nothing
{
  let g = startClash16(base({ hand: [SLAM, JAB, HOOK, THROW] }, { hand: [id(ZO, 'Read'), POKE, SHOT] }, 'close'), SLAM, id(ZO, 'Read'))
  while (g.pending) g = decideClash16(g, null)
  ok(g.clash.winner === 0 && heatOf(g, 0) === 2 && g.B.hp === ZO.hp - 3, `Body Slam beats a Guard: builds its 2 Charge and deals 3 (${heatOf(g, 0)} Charge, ${ZO.hp - g.B.hp} damage)`)
  const G0 = base({ hand: [JAB] }, { hand: [BACK] }, 'close')
  let h = startClash16({ ...G0, B: { ...G0.B, pile: 5 } }, JAB, BACK)       // the pile on B is the Brawler's Charge
  while (h.pending) h = decideClash16(h, null)
  ok(h.clash.winner === 1 && heatOf(h, 0) === 5, `Backstep beats Jab: the Brawler keeps his 5 Charge (${heatOf(h, 0)})`)
  const d = startDraw16({ ...h, A: { ...h.A, used: [] }, B: { ...h.B, used: [] } })
  ok(heatOf(d, 0) === 5 && heatOf(d, 1) === heatOf(h, 1), 'no Charge at the end of the round')
  let s2 = startClash16(base({ hand: [BLOCK] }, { hand: [POKE] }, 'far'), BLOCK, POKE)
  while (s2.pending) s2 = decideClash16(s2, null)
  ok(s2.range === 'close', `Step In beats Poke: the fight moves to Close (${s2.range})`)
}
// 9. Card text
{
  const dash = cardLines16(J.brawler.cards.find(c => c.name === 'Dash Punch')).text.join(' ')
  ok(dash.includes('Moves the fight to Close, win or lose'), 'Dash Punch says it moves the fight')
  const back = cardLines16(J.zoner.cards.find(c => c.name === 'Backstep')).text.join(' ')
  ok(back.includes('the fight moves to Far'), 'Backstep says it moves the fight to Far')
}
// 10. Whole games
{
  let n = 0, timeouts = 0, moved = 0, chargeMoves = 0
  for (let i = 0; i < 30; i++) {
    const g = playGame18(BR, ZO, { rules, W, seed: 100 + i })
    n++; if (g.timedOut) timeouts++
    for (const r of g.rounds) { if (r.rangeAt && r.range !== r.rangeAt) moved++; for (const k of [0, 1]) if (r.bought?.[k]?.move) chargeMoves++ }
    ok(g.result !== null, `game ${i} finishes`)
  }
  ok(moved > 30, `the range changes in play (${moved} times in 30 games)`)
  ok(chargeMoves > 10, `players move with Charge (${chargeMoves} times in 30 games)`)
}

// 11. The page's match logic: hot-seat games, every prompt answered by a simple chooser
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const M = await import('../src/app/v16/match16.js')
{
  let games = 0, steps = 0, moves = 0, buys = 0, notesRange = 0, why = 0
  for (let s = 0; s < 6; s++) {
    let m = M.startMatch16({ fighters: [J.brawler, J.zoner], mode: 'hotseat', settings: S, seed: 300 + s, id: 'g' + s })
    let guard = 0
    while (m.phase !== 'over' && guard++ < 3000) {
      steps++
      if (m.pass) { m = M.continueAfterPass(m); continue }
      const side = m.turn
      if (m.phase === 'clash') {
        const X = side === 0 ? m.G.A : m.G.B
        const okSet = M.clashSet(m, side)
        const groups = M.handGroups(X, okSet, M.clashWhy(X))
        if (groups.some(g => !g.ok && /Out of reach/.test(g.why || ''))) why++
        if (M.boardNotes16(m, side).some(n => /The fight is at/.test(n.text))) notesRange++
        const opts = [...okSet]
        m = M.choosePick(m, side, opts.length ? opts[(s + m.G.round) % opts.length] : null)
      } else if (m.phase === 'rider') {
        const list = M.riderList(m, side); m = M.chooseRider(m, side, list[0].opt)
      } else if (m.phase === 'stage') {
        const so = M.stageOptions(m), all = [...so.link, ...so.end]
        m = all.length && m.G.round % 2 ? M.chooseStageCard(m, all[0]) : (m.G.pending.stage === 'link' ? M.stopCombo(m) : M.chooseStage(m, null))
      } else if (m.phase === 'confiscate') {
        const X = side === 0 ? m.G.A : m.G.B; m = M.chooseConfiscated(m, side, X.hand.slice(0, X.owe))
      } else if (m.phase === 'buy') {
        const list = M.buyList(m, side)
        const mv = list.find(o => o.move)
        if (mv && mv.label.includes('Move the fight')) moves++
        const pick = mv && (m.G.round + side) % 2 ? mv : list.find(o => o.card) || list[0]
        if (pick.card) buys++
        m = M.chooseBuy(m, side, pick.opt)
      } else if (m.phase === 'discard') {
        const X = side === 0 ? m.G.A : m.G.B; m = M.chooseDiscard(m, side, X.hand.slice(0, m.G.discardDown[side]))
      } else if (m.phase === 'reveal') m = M.nextRound16(m)
      else { ok(false, `unexpected phase ${m.phase}`); break }
    }
    ok(m.phase === 'over', `hot-seat game ${s} reaches the end (${m.phase}, round ${m.G.round})`)
    games++
  }
  ok(moves > 0, `the end-of-round list offers moving the fight (${moves} times)`)
  ok(notesRange > 0, 'the board notes say where the fight is')
  ok(why > 0, 'out-of-reach cards are explained')
  ok(games === 6, 'six hot-seat games played')
}

console.log(`${passes}/${passes + fails} pass`)
if (fails) process.exit(1)
