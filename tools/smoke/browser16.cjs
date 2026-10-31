// Real-browser click-through (Playwright and Chromium) of the built v16 page, with Preact and htm served
// from local source clones (the CDN isn't reachable from here).
// usage: node tools/smoke/browser16.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir>: pkg/preact and pkg/htm source clones.
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const PAGE = process.argv[2] || 'dist/yomi-playtest-v16.html'
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
  async function playGame(page, { hotseat = false, shots = false, maxSteps = 600 } = {}) {
    const seen = { neutralCard: 0, focus: 0, breather: 0, blank: 0, follow: 0, link: 0, end: 0, discard: 0, pass: 0, rounds: 0 }
    let shotN = 0
    const shot = async name => { if (shots && SHOTS && shotN < 12) { shotN++; await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true }) } }
    for (let step = 0; step < maxSteps; step++) {
      const t = (await page.locator('main').innerText()).toLowerCase()
      if (await page.locator('.overlay').count()) { seen.pass++; await page.locator('.overlay .btn').click(); continue }
      if (t.includes('k.o.') || (t.includes('round limit reached'))) return seen
      const nhand = page.locator('.neutral-hand button.card')
      if (await nhand.count()) {
        const n = await nhand.count()
        await nhand.nth(step % n).click()
        const name = (await page.locator('.actions .btn', { hasText: /^Play / }).first().innerText()).toLowerCase()
        seen[name.includes('focus') ? 'focus' : 'neutralCard']++
        await page.locator('.actions .btn', { hasText: /^Play / }).first().click(); continue
      }
      if (await btn(page, 'Lock in').count()) {
        if (seen.rounds === 1) await shot('03-clash-pick')
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
        if (seen[key] === 1) await shot(`04-${key}`)
        const cards = page.locator('.hand button.card:not([disabled])')
        if (await cards.count() && step % 3) { await cards.first().click(); await btn(page, 'Play it').click() }
        else await page.locator('.hand-wrap .actions .btn.ghost').first().click()
        continue
      }
      if (await page.locator('.actions .btn', { hasText: /^Discard \d/ }).count()) {
        seen.discard++
        const need = Number((await page.locator('.actions .btn', { hasText: /^Discard \d/ }).innerText()).match(/\d+/)[0])
        for (let k = 0; k < need; k++) await page.locator('.hand button.card').nth(k).click()
        await page.locator('.actions .btn', { hasText: /^Discard \d/ }).click(); continue
      }
      if (await btn(page, 'Draw · next round').count()) {
        seen.rounds++
        if (seen.rounds === 2) await shot('05-reveal')
        await btn(page, 'Draw · next round').click(); continue
      }
      await page.waitForTimeout(50)
    }
    ok(false, 'game finished within the step budget')
    return seen
  }

  const { page } = await newPage(1280, 900)
  const body = async () => (await page.locator('body').innerText()).toLowerCase()
  ok((await body()).includes('rules v16'), 'header says rules v16')
  ok((await page.locator('.fpick[aria-pressed="true"]').allInnerTexts()).every(t => t.toLowerCase().includes('benchmark')), 'Benchmark picked on both sides')
  ok((await body()).includes('20 clash + 8 neutral cards'), 'the picker shows both deck sizes')
  SHOTS && await page.screenshot({ path: SHOTS + '01-setup.png', fullPage: true })

  await btn(page, 'Start the match').click()
  await page.waitForSelector('.neutral-hand button.card')
  ok(await page.locator('.notes li').count() > 0, 'board notes show in the neutral phase')
  ok(await page.locator('.neutral-hand button.card').count() >= 1 && !(await btn(page, 'Burn for meter…').count()) && !(await page.locator('.actions .btn', { hasText: /^Focus:/ }).count()), 'split decks: a neutral hand to pick from; no Focus button, no burn')
  ok((await body()).includes('neutral in hand') && (await body()).includes('in neutral deck'), 'HUD shows the neutral hand and deck')
  ok((await body()).includes('in hand') && (await body()).includes('in deck'), 'HUD shows hand and deck counts')
  SHOTS && await page.screenshot({ path: SHOTS + '02-neutral.png', fullPage: true })
  const seen = await playGame(page, { shots: true })
  console.log('vs Hard:', JSON.stringify(seen))
  ok(seen.rounds > 3, 'played several rounds')
  ok(seen.neutralCard > 0 && seen.focus > 0, 'played Focus and another neutral card')
  SHOTS && await page.screenshot({ path: SHOTS + '06-over.png', fullPage: true })
  await page.waitForSelector('text=Saved to the playtest log', { timeout: 5000 }).catch(() => {})
  ok((await body()).includes('saved to the playtest log'), 'the game is logged')

  // a few more games to shake out rarer paths (statuses, Supers, reshuffles, the hand limit)
  let more = { follow: 0, link: 0, end: 0, discard: 0, focus: 0 }
  for (let g = 0; g < 4; g++) {
    await btn(page, 'Rematch').click()
    const s = await playGame(page)
    for (const k of Object.keys(more)) more[k] += s[k]
  }
  console.log('4 more games:', JSON.stringify(more))
  ok(seen.follow + seen.link + seen.end + more.follow + more.link + more.end > 0, 'was offered a follow-up or a combo')

  // the log
  await page.getByRole('button', { name: 'Playtest log' }).click()
  await page.waitForSelector('text=How games end')
  ok((await page.locator('.game-row').count()) >= 5, 'five games in the log')
  await page.locator('.game-row .link', { hasText: 'Rounds' }).first().click()
  ok((await body()).includes(' vs '), 'a logged game expands to its rounds')
  SHOTS && await page.screenshot({ path: SHOTS + '07-log.png', fullPage: true })

  // decks
  await btn(page, 'Decks').click()
  await page.waitForSelector('text=Counters')
  ok(await page.locator('.cards-grid .card').count() === 10, 'nine cards and the Super')
  await page.getByRole('button', { name: 'One more Jab' }).click()
  ok((await body()).includes('unsaved changes') && (await body()).includes('29'), 'copies edit: 29 cards, unsaved')
  await btn(page, 'Save').click()
  await page.waitForSelector('text=Edited', { timeout: 5000 })
  ok((await body()).includes('edited'), 'saved as an edit')
  SHOTS && await page.screenshot({ path: SHOTS + '08-decks.png', fullPage: true })
  await btn(page, 'JSON').click()
  await page.locator('textarea').fill('{ "rules": 16, "id": "x" ')
  ok((await body()).includes("doesn't parse"), 'bad JSON is reported')
  await btn(page, 'Discard changes').click()
  await btn(page, 'Reset to bundled').click()
  await page.locator('.confirm .btn', { hasText: 'Reset' }).click()
  await page.waitForTimeout(300)
  ok(!(await body()).includes('unsaved changes'), 'reset')

  // settings
  await btn(page, 'Settings').click()
  ok(await page.locator('#s-burnMax').inputValue() === '0' && await page.locator('#s-meterMax').inputValue() === '4', 'defaults: no burning, meter track 0–4')
  const lim = page.locator('#s-handLimit')
  await lim.click(); await page.keyboard.press('End'); await page.keyboard.press('Backspace')
  ok(await lim.inputValue() === '', 'an emptied field stays empty while typing')
  await page.keyboard.type('13')
  ok(await lim.inputValue() === '13' && await lim.evaluate(e => e.classList.contains('bad')), 'out of range is flagged, not snapped')
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.type('7')
  await page.locator('h1').click()
  ok(await lim.inputValue() === '7' && (await body()).includes('as written: 8'), 'typed over: 7')
  const alpha = page.locator('#s-alpha')
  await alpha.click(); await alpha.press('Control+a'); await page.keyboard.type('0.45')
  ok(await alpha.inputValue() === '0.45', 'decimals can be typed')
  await page.locator('h1').click()
  await btn(page, 'Use the defaults').click()
  await page.locator('#s-handLimit').fill('7')
  await page.locator('#s-superuses').selectOption('1')
  await btn(page, 'Save settings').click()
  await page.waitForTimeout(300)
  await btn(page, 'Play').click()
  if (await btn(page, 'New match').count()) await btn(page, 'New match').click()
  ok((await body()).includes('hand limit 7') && (await body()).includes('play one of your 3 neutral cards') && (await body()).includes('once per game'), 'setup shows the new settings')

  // lab
  await btn(page, 'Lab').click()
  await page.locator('.seg button', { hasText: /^100$/ }).click()
  await btn(page, 'Run this matchup').click()
  await page.waitForSelector('text=How games end', { timeout: 60000 })
  ok((await body()).includes('combos') && (await body()).includes('guard beats pressure'), 'lab report')
  await btn(page, 'Run the exploit check').click()
  await page.waitForSelector('text=Exploit check', { timeout: 120000 })
  ok(await page.locator('.tbl tbody tr').count() >= 5, 'exploit check rows')
  SHOTS && await page.screenshot({ path: SHOTS + '09-lab.png', fullPage: true })

  // two players on one device
  await btn(page, 'Play').click()
  if (await btn(page, 'New match').count()) await btn(page, 'New match').click()
  await page.locator('.seg button', { hasText: 'Two players, one device' }).click()
  await btn(page, 'Start the match').click()
  await page.waitForSelector('.neutral-hand button.card')
  const hs = await playGame(page, { hotseat: true, maxSteps: 900 })
  console.log('hot-seat:', JSON.stringify(hs))
  ok(hs.pass > 2, 'hot-seat asks for the device to change hands')

  // watch, at phone width
  const { page: phone } = await newPage(390, 844)
  await phone.locator('.seg button', { hasText: 'Watch the sparring partner' }).click()
  await btn(phone, 'Start the match').click()
  for (let k = 0; k < 6; k++) { await phone.waitForSelector('text=Draw · next round'); await btn(phone, 'Draw · next round').click() }
  const sw = await phone.evaluate(() => document.documentElement.scrollWidth)
  ok(sw <= 391, `no horizontal scroll at phone width (${sw})`)
  SHOTS && await phone.screenshot({ path: SHOTS + '10-phone.png', fullPage: true })

  ok(!errors.length, 'no page errors: ' + errors.slice(0, 5).join(' | '))
  console.log(`${checks - fails}/${checks} checks passed`)
  await browser.close()
  process.exit(fails ? 1 : 0)
})()
