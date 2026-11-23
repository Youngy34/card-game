// node summarise.mjs <dir> <tag>: one JSON summary of a tag's runs (turns pool, the nod/odg ladder, Hard v Medium)
import fs from 'fs'
const [dir, tag] = process.argv.slice(2)
const J = f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))
const t = J(`${tag}_pool.json`).report
// a variant's win rate against Hard: side 0's kind (x0) wins as side 0; side 1's (x1) wins 1 - side 0's
const variant = (files, k) => { let w = 0, n = 0; for (const f of files) for (const r of J(f)) { if (r.kind === `${k}0`) { w += r.win * r.n; n += r.n } if (r.kind === `${k}1`) { w += (1 - r.win) * r.n; n += r.n } } return { win: w / n, games: n } }
const lad = [`ladder_${tag}_bz.json`, `ladder_${tag}_zb.json`], med = [`medium_${tag}_bz.json`, `medium_${tag}_zb.json`]
const nod = variant(lad, 'nod'), odg = variant(lad, 'odg'), medium = variant(med, 'lvl:medium')
const B = t.by.Brawler, Z = t.by.Zoner
console.log(JSON.stringify({ tag,
  brawlerFarLe2: B.le2Away, brawlerFarOne: B.oneAway, brawlerPoor3: B.gamesPoor3, brawlerSpell3: B.spell3plus, brawlerHand: B.handAtClash,
  zonerCloseLe2: Z.le2Away, zonerSpell3: Z.spell3plus,
  swing: t.swing, timeouts: t.timeouts, brawler: t.brawler, firstPlayer: t.firstPlayer, median: t.median,
  eitherOd: t.eitherOdShare, bothOd: t.bothOdShare, odBuys: t.odBuysPerGame, chargeUps: t.kindsPerGame['charge up'] || 0, cuMove: t.cuMovePerGame,
  rangeChanges: t.rangeChangesPerGame, moves: t.kindsPerGame['charge move'] || 0, firstMoves: t.firstMovesPerGame, firstUndone: t.firstUndoneShare,
  secondWinsNext: t.secondWinsNextClash, moveOdFirst: t.moveOdFirstPerGame, moveOdSecond: t.moveOdSecondPerGame, knockdowns: t.knockdownsPerGame,
  playerActs: t.playerActs,
  neverOd: nod, neverOdCost: 0.5 - nod.win, odWhenever: odg, odWheneverCost: 0.5 - odg.win, medium }, null, 1))
