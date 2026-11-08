// Real-browser click-through (Playwright and Chromium) of the built v18 page (rules-overview 18.md), with Preact and htm served
// from local source clones (the CDN isn't reachable from here).
// usage: node tools/smoke/browser18.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir>: pkg/preact and pkg/htm source clones.
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const PAGE = process.argv[2] || 'dist/yomi-playtest-v18.html'
// The bundled Benchmark, so the deck checks follow its file (26 cards since 7 November)
// SMOKE_EDITION=v19 checks the v19 test page against its own fighter files
const ED = process.env.SMOKE_EDITION || 'v18'
const DATA = n => JSON.parse(fs.readFileSync(path.join(__dirname, `../../data/${ED}/${n}.json`), 'utf8'))
const BM = DATA('benchmark'), WD = DATA('warden'), VX = DATA('vex'), AT = DATA('atlas')
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, `../../data/${ED}/settings.json`), 'utf8')).rules
const CAP = RULES.greyCap || 0, OVF = !!(CAP && RULES.greyOverflow)
// the picker's "· grey cap N" (a fighter's own cap, or the rule's), when the cap is on
const capTxt = f => (CAP ? ` · grey cap ${f.greyCap || CAP}` : '')
const BM_SIZE = BM.cards.filter(c => !c.special).reduce((s, c) => s + c.copies, 0)
const VENDOR = process.argv[3]
const SHOTS = process.argv[4] ? process.argv[4] + '/' : null
let html = fs.readFileSync(PAGE, 'utf8')
html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>\s*/g, '')
const boot = `<script type="importmap">{"imports":{"preact":"/v/preact/src/index.js","preact/hooks":"/v/preact/hooks/src/index.js"}}</script>
<script type="module">import * as p from 'preact'; import * as h from 'preact/hooks'; import htm from '/v/htm/src/index.mjs'; window.preact = p; window.preactHooks = h; window.htm = htm;</script>`
const i = html.lastIndexOf('<script>')
html = html.slice(0, i) + boot + '\n<script type="module">' + html.slice(i + 8)
const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  let checks = 0, fails = 0
  const ok = (c, what) => { checks++; if (!c) { fails++; console.log('FAIL:', what) } }
  async function newPage(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push('pageerror: ' + e.message))
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()) })
    await page.route('**/*', async route => {
      const u = new URL(route.request().url())
      if (u.hostname === 'yomi.test' && u.pathname === '/') return route.fulfill({ body: doc, contentType: 'text/html' })
      if (u.hostname === 'yomi.test' && u.pathname.startsWith('/v/')) {
        let f = path.join(VENDOR, 'pkg', u.pathname.slice(3))
        if (!fs.existsSync(f) && fs.existsSync(f + '.js')) f += '.js'
        if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' })
        return route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' })
      }
      return route.abort()
    })
    await page.goto('https://yomi.test/')
    await page.waitForSelector('text=Fight night', { timeout: 15000 })
    return { ctx, page }
  }
  const btn = (page, name) => page.getByRole('button', { name, exact: true })
  const has = async (page, name) => (await btn(page, name).count()) > 0 && await btn(page, name).first().isEnabled()

  // Play one whole game against the partner (or two players), answering every prompt
  async function playGame(page, { shots = false, maxSteps = 700 } = {}) {
    const seen = { follow: 0, link: 0, end: 0, discard: 0, confiscate: 0, rider: 0, read: 0, recall: 0, took: 0, pass: 0, rounds: 0, table: 0, timeout: 0, ko: 0, timeNote: 0, knownNote: 0, twin: 0, block: 0 }
    let shotN = 0
    const shot = async name => { if (shots && SHOTS && shotN < 12) { shotN++; await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true }) } }
    for (let step = 0; step < maxSteps; step++) {
      const t = (await page.locator('main').innerText()).toLowerCase()
      if (await page.locator('.overlay').count()) { seen.pass++; await page.locator('.overlay .btn').click(); continue }
      if (t.includes('time-out:') && await btn(page, 'Rematch').count()) { seen.timeout++; return seen }
      if (t.includes('k.o.') || t.includes('round limit reached')) { seen.ko++; return seen }
      if (t.includes('· in hand') || t.includes('· used')) seen.table++
      if (t.includes('time-out: ') && t.includes('left in your deck')) seen.timeNote++
      if (t.includes('with recall: it')) seen.knownNote++
      if (t.includes('turns the blow aside')) seen.block++
      if (t.includes('reached the cap of')) seen.cap = (seen.cap || 0) + 1
      if (t.includes('is lost as hp') || t.includes('pile was full') || t.includes('pile is full')) seen.full = (seen.full || 0) + 1
      const rider = page.locator('.hand-wrap h3', { hasText: /: (read|recall)$/i })
      if (await rider.count()) {
        seen.rider++
        const h = (await rider.first().innerText()).toLowerCase()
        if (h.endsWith('recall')) seen.recall++; else seen.read++
        if (seen.rider === 1) await shot('04-rider')
        const cards = page.locator('.hand-wrap .hand button.card'), bs = page.locator('.hand-wrap .actions .btn')
        const nc = await cards.count(), nb = await bs.count()
        if (nc && (step % 2 || !nb)) { if (h.endsWith('read')) seen.took++; await cards.nth(step % nc).click() }
        else await bs.first().click()
        continue
      }
      if (await btn(page, 'Lock in').count()) {
        if (seen.rounds === 1) await shot('03-clash-pick')
        ok(!(await btn(page, 'Play nothing (Focus)').count()), 'v18: no "play nothing" while you hold a card')
        const cards = page.locator('.hand button.card:not([disabled])')
        const n = await cards.count()
        ok(n > 0, 'some clash card is playable')
        await cards.nth(step % n).click()
        await btn(page, 'Lock in').click(); continue
      }
      if (await btn(page, 'Play it').count()) {
        const h = (await page.locator('.hand-wrap h3').first().innerText()).toLowerCase()
        const key = h.includes('counter') ? 'follow' : h.includes('linker') ? 'link' : 'end'
        seen[key]++
        if (h.startsWith('twin')) { seen.twin++; await shot('04-twin'); await page.locator('.hand button.card:not([disabled])').first().click(); await btn(page, 'Play it').click(); continue }
        const twin = page.locator('.hand button.card:not([disabled])', { hasText: 'Twin Fang' })
        if (key === 'link' && await twin.count()) { await twin.first().click(); await btn(page, 'Play it').click(); continue }
        if (seen[key] === 1) await shot(`04-${key}`)
        const cards = page.locator('.hand button.card:not([disabled])')
        if (await cards.count() && step % 3) { await cards.first().click(); await btn(page, 'Play it').click() }
        else await page.locator('.hand-wrap .actions .btn.ghost').first().click()
        continue
      }
      if (await page.locator('.actions .btn', { hasText: /^Discard \d/ }).count()) {
        const h = (await page.locator('.hand-wrap h3').first().innerText()).toLowerCase()
        if (h.startsWith('confiscate')) { seen.confiscate++; if (seen.confiscate === 1) await shot('05-confiscate') } else seen.discard++
        const need = Number((await page.locator('.actions .btn', { hasText: /^Discard \d/ }).innerText()).match(/\d+/)[0])
        for (let k = 0; k < need; k++) await page.locator('.hand button.card').nth(k).click()
        await page.locator('.actions .btn', { hasText: /^Discard \d/ }).click(); continue
      }
      const draw = page.getByRole('button', { name: /^Draw · / })
      if (await draw.count()) {
        seen.rounds++
        if (seen.rounds === 2) await shot('05-reveal')
        seen.drawLabel = await draw.first().innerText()
        await draw.first().click(); continue
      }
      await page.waitForTimeout(50)
    }
    ok(false, 'game finished within the step budget')
    return seen
  }
  const sum = (a, b) => { for (const k of Object.keys(b)) if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; return a }

  const { page } = await newPage(1280, 900)
  const body = async () => (await page.locator('body').innerText()).toLowerCase()
  ok((await body()).includes('rules v18'), 'header says rules v18')
  ok((await page.locator('.fpick[aria-pressed="true"]').allInnerTexts()).every(t => t.toLowerCase().includes('benchmark')), 'Benchmark picked on both sides')
  ok((await body()).includes(`${BM.hp} hp${capTxt(BM)} · ${BM_SIZE} cards + 2 specials`), `the picker shows HP ${BM.hp}${capTxt(BM)} and the ${BM_SIZE}-card deck`)
  ok((await body()).includes(`${WD.hp} hp${capTxt(WD)} · 26 cards + 2 specials · super: chain prison`), `the Warden at HP ${WD.hp}, 26 cards`)
  if (CAP) ok((await body()).includes(`${VX.hp} hp${capTxt(VX)}`) && (await body()).includes(`${AT.hp} hp${capTxt(AT)}`), `the picker shows Vex's and Atlas's own caps (${VX.greyCap || CAP}, ${AT.greyCap || CAP})`)
  if (RULES.cashOnWin) ok((await body()).includes('a convert cashes only as the clash card'), 'setup states that a Convert cashes only as the clash card')
  if (OVF) ok((await body()).includes('grey beyond it is lost as hp'), 'setup states the overflow cap')
  if (RULES.comboSameType) ok((await body()).includes("a combo continues only with cards of its starter's type"), 'setup states the two combo lines')
  ok((await body()).includes('the game times out when a deck runs out') && (await body()).includes('one step a round'), 'setup states the time-out and the one-step round')
  ok((await body()).includes('knows you can\'t see its own'), 'setup describes the new partner')
  SHOTS && await page.screenshot({ path: SHOTS + '01-setup.png', fullPage: true })

  await btn(page, 'Start the match').click()
  await page.waitForSelector('.hand button.card')
  ok(await btn(page, 'Lock in').count() === 1, 'the round starts at the clash card (no neutral step)')
  ok(!(await body()).includes('neutral in hand'), 'no neutral hand in the HUD')
  ok((await page.locator('.hud-flags .flag', { hasText: 'Initiative' }).count()) === 1, 'exactly one player holds the initiative')
  ok((await page.locator('.hud', { hasText: 'Rising Strike · 1 meter' }).count()) === 2 && (await body()).includes('overdrive · 2 meter'), 'specials and the Super start on the table')
  ok((await body()).includes(`${BM_SIZE - 6} in deck`), `HUD shows ${BM_SIZE - 6} cards left in the deck`)
  if (CAP) {
    ok((await page.locator('.pile-n').allInnerTexts()).every(t => t.endsWith(`/${BM.greyCap || CAP}`)), `the HUD shows each pile against the cap of ${BM.greyCap || CAP}`)
    ok((await body()).includes(`grey cap ${CAP}`) || (await page.locator('.pile[title*="Grey cap"]').count()) === 2, 'the cap is explained')
  }
  const seen = await playGame(page, { shots: true })
  console.log('vs Hard:', JSON.stringify(seen))
  ok(seen.rounds > 3, 'played several rounds')
  ok((seen.drawLabel || '').toLowerCase() === 'draw · take 1 grey · pass the initiative', `the draw button (${seen.drawLabel})`)
  SHOTS && await page.screenshot({ path: SHOTS + '06-over.png', fullPage: true })
  await page.waitForSelector('text=Saved to the playtest log', { timeout: 5000 }).catch(() => {})
  ok((await body()).includes('saved to the playtest log'), 'the game is logged')

  let more = {}
  for (let g = 0; g < 5; g++) { await btn(page, 'Rematch').click(); sum(more, await playGame(page)) }
  console.log('5 more games:', JSON.stringify(more))
  const all = sum({ ...more }, seen)
  ok(all.follow + all.link + all.end > 0, 'was offered a follow-up or a combo')

  // against the Warden: Confiscate prompts
  await btn(page, 'New match').click()
  await page.locator('.pickers .fighters').nth(1).locator('.fpick', { hasText: 'The Warden' }).click()
  await btn(page, 'Start the match').click()
  await page.waitForSelector('.hand button.card')
  let w = {}
  for (let g = 0; g < 3; g++) { if (g) await btn(page, 'Rematch').click(); sum(w, await playGame(page, { shots: g === 0 })) }
  console.log('3 games vs the Warden:', JSON.stringify(w))
  sum(all, w)
  // the rarer prompts depend on how the games go: play on (up to 6 more) until each has come up
  for (let g = 0; g < 6 && !(all.read && all.recall && all.took && all.table && all.timeNote); g++) {
    await btn(page, 'Rematch').click(); sum(all, await playGame(page))
  }
  ok(w.confiscate > 0, 'the Warden Confiscates: you pick what to discard')
  ok(all.read > 0, 'a Read rider offered its choice after the reveal')
  ok(all.recall > 0, 'a Recall rider offered its choice after the reveal')
  ok(all.took > 0, 'you took a card from the table')
  ok(all.table > 0, 'the table row shows a special in hand')
  ok(all.timeNote > 0, 'board notes warn of the time-out near the end of the deck')
  console.log('endings: KO', all.ko, '· time-out', all.timeout, '· cap notes', all.cap || 0)
  console.log('full-pile notes', all.full || 0)
  if (OVF) ok((all.full || 0) > 0, 'a full pile was narrated (grey lost as HP)')
  else if (CAP) ok((all.cap || 0) > 0, 'a cap cash was narrated (board note or game-over line)')

  // the 8 November drafts: you as Vex against Bastion (Twin, Repulse), then you as Atlas against Vex
  await btn(page, 'New match').click()
  ok((await body()).includes(`${VX.hp} hp${capTxt(VX)} · 26 cards + 2 specials · super: hundred fang`) && (await body()).includes(`${AT.hp} hp${capTxt(AT)} · 26 cards + 2 specials · super: avalanche`), `the picker lists Vex (HP ${VX.hp}) and Atlas (HP ${AT.hp})`)
  ok((await page.locator('.pickers .fighters').nth(0).locator('.fpick', { hasText: 'Bastion' }).count()) === 1, 'the picker lists Bastion')
  await page.locator('.pickers .fighters').nth(0).locator('.fpick', { hasText: 'Vex' }).click()
  await page.locator('.pickers .fighters').nth(1).locator('.fpick', { hasText: 'Bastion' }).click()
  await btn(page, 'Start the match').click()
  await page.waitForSelector('.hand button.card')
  ok((await body()).includes('aegis · 1 meter') && (await body()).includes('final bastion · 2 meter'), "Bastion's Guard special and Guard Super are on the table")
  ok((await page.locator('.hand button.card', { hasText: /Fang|Undercut|Pommel|Crossing|Heel|Recall|Charge|Read/ }).count()) > 0, "you hold Vex's cards")
  const d = {}
  for (let g = 0; g < 10 && !(d.twin && d.block); g++) { if (g) await btn(page, 'Rematch').click(); sum(d, await playGame(page, { shots: g === 0 })) }
  console.log('Vex v Bastion:', JSON.stringify(d))
  ok(d.twin > 0, 'Twin: the second Twin Fang was offered as another Linker')
  ok(d.block > 0, "a Repulse, Aegis or Final Bastion block's status was narrated")
  await btn(page, 'New match').click()
  await page.locator('.pickers .fighters').nth(0).locator('.fpick', { hasText: 'Atlas' }).click()
  await page.locator('.pickers .fighters').nth(1).locator('.fpick', { hasText: 'Vex' }).click()
  await btn(page, 'Start the match').click()
  await page.waitForSelector('.hand button.card')
  const a = await playGame(page)
  console.log('Atlas v Vex:', JSON.stringify(a))
  ok(a.ko + a.timeout === 1, 'Atlas v Vex plays to the end')

  // the log
  await page.getByRole('button', { name: 'Playtest log' }).click()
  await page.waitForSelector('text=How games end')
  ok((await page.locator('.game-row').count()) >= 9, 'nine games in the log')
  await page.locator('.game-row .link', { hasText: 'Rounds' }).first().click()
  ok((await body()).includes(' vs '), 'a logged game expands to its rounds')
  SHOTS && await page.screenshot({ path: SHOTS + '07-log.png', fullPage: true })

  // decks
  await btn(page, 'Decks').click()
  await page.waitForSelector('text=Counters')
  const nCards = await page.locator('.cards-grid .card').count()
  ok(nCards === BM.cards.length + 1, `${BM.cards.length - 2} cards, two specials and the Super (${nCards})`)
  SHOTS && await page.screenshot({ path: SHOTS + '08-decks.png', fullPage: true })

  // settings
  await btn(page, 'Settings').click()
  ok(!(await page.locator('#s-burnMax').count()) && !(await page.locator('#s-neutralHand').count()), 'v18 hides the neutral-step dials')
  ok(await page.locator('#s-meterMax').inputValue() === '3' && await page.locator('#s-greyPerRound').inputValue() === '1', 'defaults: meter 0–3, 1 grey a round')
  ok(await page.locator('#s-tie').inputValue() === 'initiative', 'speed ties go to the initiative holder')
  ok(await page.locator('#s-mySamples').inputValue() === '4', 'the partner deals itself 4 hands')
  await page.locator('#s-mySamples').fill('2'); await page.locator('h1').click()
  await btn(page, 'Use the defaults').click()
  ok(await page.locator('#s-mySamples').inputValue() === '4', '"Use the defaults" keeps the page\'s own partner settings')
  await page.locator('#s-handLimit').fill('7')
  await btn(page, 'Save settings').click()
  await page.waitForTimeout(300)
  await btn(page, 'Play').click()
  if (await btn(page, 'New match').count()) await btn(page, 'New match').click()
  ok((await body()).includes('hand limit 7'), 'setup shows the new settings')

  // lab
  await btn(page, 'Lab').click()
  await page.locator('.seg button', { hasText: /^100$/ }).click()
  await btn(page, 'Run this matchup').click()
  await page.waitForSelector('text=How games end', { timeout: 240000 })
  ok((await body()).includes('time-outs') && (await body()).includes('guard beats pressure') && !(await body()).includes('neutral phase'), 'lab report (time-outs, no neutral phase)')
  SHOTS && await page.screenshot({ path: SHOTS + '09-lab.png', fullPage: true })

  // two players on one device
  await btn(page, 'Play').click()
  if (await btn(page, 'New match').count()) await btn(page, 'New match').click()
  await page.locator('.seg button', { hasText: 'Two players, one device' }).click()
  await btn(page, 'Start the match').click()
  const hs = await playGame(page, { maxSteps: 1000 })
  console.log('hot-seat:', JSON.stringify(hs))
  ok(hs.pass > 2, 'hot-seat asks for the device to change hands')

  // watch, at phone width
  const { page: phone } = await newPage(390, 844)
  await phone.locator('.seg button', { hasText: 'Watch the sparring partner' }).click()
  await btn(phone, 'Start the match').click()
  for (let k = 0; k < 6; k++) { await phone.waitForSelector('text=/^Draw · /', { timeout: 30000 }); await phone.getByRole('button', { name: /^Draw · / }).first().click() }
  const sw = await phone.evaluate(() => document.documentElement.scrollWidth)
  ok(sw <= 391, `no horizontal scroll at phone width (${sw})`)
  SHOTS && await phone.screenshot({ path: SHOTS + '10-phone.png', fullPage: true })

  ok(!errors.length, 'no page errors: ' + errors.slice(0, 5).join(' | '))
  console.log(`${checks - fails}/${checks} checks passed`)
  await browser.close()
  process.exit(fails ? 1 : 0)
})()
