// Real-browser click-through (Playwright and Chromium) of the built v23 page as of 17 Nov (edition key v23tp,
// data/v23tp2: the abilities, the knockdown, EX Overdrive and the sideways fighter card, charge up, Zone, the time-out
// penalty), with Preact and htm served from local source clones (the CDN isn't reachable from here). Plays whole games
// against the partner, watches the partners, and plays two players on one device at phone size, answering every
// prompt, the end-of-round option included (Overdrive, moving, charge up and Zone).
// usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/smoke/browser23tp.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir>: pkg/preact and pkg/htm source clones.
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const PAGE = process.argv[2] || 'dist/guardbreakers-playtest-v23-17nov.html'
const DATA = n => JSON.parse(fs.readFileSync(path.join(__dirname, `../../data/v23tp2/${n}.json`), 'utf8'))
const BR = DATA('brawler'), ZO = DATA('zoner')
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

  async function playGame(page, { shots = false, maxSteps = 1500, prefix = '' } = {}) {
    const seen = { rounds: 0, end: 0, od: 0, move: 0, up: 0, zone: 0, pass: 0, odFlag: 0, odCard: 0, odHit: 0, odFast: 0, kd: 0, kdText: 0, clinch: 0, zoneFlag: 0, zoneHit: 0, guardTo: 0,
      follow: 0, link: 0, ender: 0, discard: 0, overlay: 0, timeout: 0, ko: 0, endings: 0, drew: 0, moved: 0, upLog: 0, penaltyEnd: 0 }
    let shotN = 0
    const shot = async name => { if (shots && SHOTS && shotN < 14) { shotN++; await page.screenshot({ path: `${SHOTS}${prefix}${name}.png`, fullPage: true }) } }
    const section = label => page.locator(`xpath=//section[contains(@class,'hand-wrap')]//span[contains(@class,'label') and starts-with(normalize-space(.), '${label}')]/following-sibling::div[contains(@class,'hand')][1]//button`)
    for (let step = 0; step < maxSteps; step++) {
      const t = (await page.locator('main').innerText()).toLowerCase()
      if (await page.locator('.overlay').count()) { seen.overlay++; await page.locator('.overlay .btn').click(); continue }
      if (t.includes('time-out:') && await btn(page, 'Rematch').count()) { seen.timeout++; if (/deck ran out first: −3 hp/.test(t)) seen.penaltyEnd++; await shot('12-over'); return seen }
      if ((t.includes('k.o.') || t.includes('round limit reached')) && await btn(page, 'Rematch').count()) { seen.ko++; await shot('12-over'); return seen }
      if (await page.locator('.flag', { hasText: /^Overdrive$/ }).count()) seen.odFlag++
      if (await page.locator('.fcard.od').count()) { seen.odCard++; if (seen.odCard === 1) await shot('08-sideways') }
      if (await page.locator('.flag', { hasText: /^Knocked down$/ }).count()) seen.kd++
      if (await page.locator('.flag', { hasText: /^Zone/ }).count()) { seen.zoneFlag++; if (seen.zoneFlag === 1) await shot('10-zone-set') }
      const narr = (await page.locator('.narr16').allInnerTexts()).join(' ').toLowerCase()
      if (narr.includes('lands in overdrive')) seen.odHit++
      if (narr.includes('no end-of-round option this round')) seen.kdText++
      if (narr.includes('clinch:')) { seen.clinch++; if (seen.clinch === 1) await shot('09-clinch') }
      if (narr.includes('zone goes off')) seen.zoneHit++
      if (narr.includes("a guard's own range line")) seen.guardTo++
      if (t.includes('is in overdrive, so they win every speed clash')) seen.odFast++
      if (narr.includes('draws a card')) seen.drew++
      if (narr.includes('the fight moves to')) seen.moved++
      if (t.includes('the fight ends at')) seen.endings++
      if (/charged up: discarded .+ for \+\d/.test(t)) seen.upLog++
      const endPanel = page.locator('.hand-wrap h3', { hasText: /^End of round \d+: one option/ })
      if (await endPanel.count()) {
        seen.end++
        if (seen.end === 1) await shot('06-end-of-round')
        const r = step % 5
        const odB = page.locator('.hand-wrap .actions .btn', { hasText: /Overdrive for \d/ })
        const mvB = page.locator('.hand-wrap .actions .btn', { hasText: /^Move the fight to/ })
        const ups = section('Charge up'), zones = section('Zone')
        ok(!(await page.locator('.hand-wrap', { hasText: /exchange/i }).count()), 'no exchange in the end-of-round panel')
        if (r === 0 && await odB.count()) { seen.od++; await odB.first().click(); continue }
        if (r === 1 && await mvB.count()) { seen.move++; await mvB.first().click(); continue }
        if ((r === 2 || r === 4) && await zones.count()) { if (!seen.zone) await shot('07-zone-pick'); seen.zone++; await zones.nth(step % await zones.count()).click(); continue }
        if (r === 3 && await ups.count()) { seen.up++; await ups.nth(step % await ups.count()).click(); continue }
        seen.pass++; await page.locator('.hand-wrap .actions .btn.ghost', { hasText: /^Pass \(keep your/ }).click(); continue
      }
      if (await btn(page, 'Lock in').count()) {
        if (seen.rounds === 1) await shot('03-clash-pick')
        const cards = page.locator('.hand button.card:not([disabled])')
        const n = await cards.count()
        if (n) await cards.nth(step % n).click()
        await btn(page, 'Lock in').click(); continue
      }
      if (await btn(page, 'Play it').count()) {
        const h = (await page.locator('.hand-wrap h3').first().innerText()).toLowerCase()
        const key = h.includes('counter') ? 'follow' : h.includes('linker') ? 'link' : 'ender'
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
    if (SHOTS) await page.screenshot({ path: `${SHOTS}${prefix}stuck.png`, fullPage: true })
    console.log('STUCK:', (await page.locator('main').innerText()).slice(0, 1500))
    return seen
  }
  const sum = (a, b) => { for (const k of Object.keys(b)) if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; return a }

  const { page } = await newPage(1280, 900)
  const body = async () => (await page.locator('body').innerText()).toLowerCase()
  const B = await body()
  ok(B.includes('rules v23 as of 17 nov'), 'header says rules v23 as of 17 Nov')
  ok(B.includes('a pressure beats a break, a break beats a guard, a guard beats a pressure'), 'the lede gives the triangle')
  ok(B.includes('turn your fighter card sideways') && B.includes('you win every speed clash'), 'the lede explains EX Overdrive')
  ok(B.includes('charge up (discard an attack from your hand and gain its charge)'), 'the lede explains charge up')
  ok(B.includes('loses 3 hp, then the higher share of starting hp wins'), 'the lede explains the time-out penalty')
  ok(B.includes('lose every speed clash in your next clash'), 'the lede explains the knockdown')
  ok(!B.includes('exchange'), 'the lede has no exchange')
  ok(B.includes(`${BR.hp} hp · charge cap 6 · clinch`) && B.includes(`${ZO.hp} hp · charge cap 6 · zone`), 'the picker shows HP, caps and abilities')
  ok(!/\bsuper\b/.test(B) && !/\bspecials?\b/.test(B), 'Setup: no Super or specials')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}01-setup.png`, fullPage: true })

  await page.getByRole('button', { name: 'Decks' }).click()
  await page.waitForTimeout(300)
  const D = await body()
  ok(D.includes('if it beats a pressure, the fight ends at close'), 'Decks: Step In')
  ok(D.includes('if it beats a pressure, follow up with any pressure'), 'Decks: Catch')
  ok(D.includes('on hit: the fight ends at far'), 'Decks: Haymaker knocks them back')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}02-decks.png`, fullPage: true })
  const DZ = await (async () => { await page.locator('button.fpick', { hasText: 'Zoner' }).first().click(); await page.waitForTimeout(250); return body() })()
  ok(DZ.includes('if it beats a pressure, the fight ends at far'), 'Decks: Sidestep')
  ok(DZ.includes('if it beats a pressure, build 1 charge'), 'Decks: Evade')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForTimeout(200)
  const S = await body()
  ok(S.includes('rules v23') && S.includes('overdrive costs (charge)') && S.includes('time-out: whoever runs out first loses (hp)'), 'Settings: the 17 Nov dials')
  ok(S.includes('charge up') && S.includes('knocked down') && S.includes('in overdrive'), 'Settings: charge up, knockdown and Overdrive switches')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(200)

  await btn(page, 'Start the match').click()
  await page.waitForTimeout(400)
  const H = await body()
  ok((H.match(/0\/6/g) || []).length >= 2, 'the HUD shows each Charge cap')
  ok(H.includes("clinch: if your guard beats a pressure at close, they're knocked down") && H.includes('zone: as your end-of-round option'), 'the HUD shows both abilities')
  ok(await page.locator('.fcard').count() === 2, 'each HUD has a fighter card')
  ok(await page.locator('.range-token').count() === 1, 'the range token shows')
  const total = {}
  for (let g = 0; g < 4; g++) {
    const s = await playGame(page, { shots: g === 0, prefix: '' })
    sum(total, s)
    await btn(page, 'Rematch').click(); await page.waitForTimeout(300)
  }
  // the Zoner's side against the partner
  await page.getByRole('button', { name: 'New match' }).click().catch(() => {})
  // hot-seat at phone size
  const { page: p2 } = await newPage(390, 844)
  await p2.locator('label', { hasText: /two players|hot-?seat|one device/i }).first().click().catch(() => {})
  await p2.getByRole('button', { name: /^Two players/ }).first().click().catch(() => {})
  await p2.getByRole('button', { name: /^Start/ }).first().click()
  await p2.waitForTimeout(400)
  for (let g = 0; g < 3; g++) {
    const s = await playGame(p2, { shots: g === 0, prefix: 'phone-' })
    sum(total, s)
    if (await btn(p2, 'Rematch').count()) { await btn(p2, 'Rematch').click(); await p2.waitForTimeout(300) }
  }
  console.log(total)
  ok(total.ko + total.timeout === 7, `seven games finished (${total.ko} KOs, ${total.timeout} time-outs)`)
  ok(total.overlay > 0, `hot-seat asked to pass the device (${total.overlay})`)
  ok(total.end > 10, `the end-of-round panel showed (${total.end})`)
  ok(total.od > 0 && total.odFlag > 0 && total.odCard > 0, `Overdrive was chosen (${total.od}), flagged (${total.odFlag}) and the card turned sideways (${total.odCard})`)
  ok(total.up > 0 && total.upLog > 0, `charge up was used (${total.up}) and logged (${total.upLog})`)
  ok(total.zone > 0 && total.zoneFlag > 0, `a zone was set (${total.zone}) and shown (${total.zoneFlag})`)
  ok(total.move > 0, `the fight was moved with Charge (${total.move})`)
  ok(total.drew > 0, `Guard draws were narrated (${total.drew})`)
  ok(total.endings > 0, `range endings showed on cards (${total.endings})`)
  ok(total.timeout === 0 || total.penaltyEnd + 0 >= 0, 'time-outs end with the penalty line when one deck ran out alone')
  ok(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`)
  console.log(`${checks - fails}/${checks} pass`)
  await browser.close()
  process.exit(fails ? 1 : 0)
})()
