// Real-browser click-through (Playwright and Chromium) of the built v23 page (edition data/v23d: Overdrive, the
// exchange, Guard draws, range endings), with Preact and htm served from local source clones (the CDN isn't reachable
// from here). Plays whole games against the partner and between two players on one device, answering every prompt,
// the end-of-round option included (Overdrive, moving and the exchange).
// usage: node tools/smoke/browser23.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir>: pkg/preact and pkg/htm source clones.
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const PAGE = process.argv[2] || 'dist/guardbreakers-playtest-v23.html'
const DATA = n => JSON.parse(fs.readFileSync(path.join(__dirname, `../../data/v23d/${n}.json`), 'utf8'))
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

  async function playGame(page, { shots = false, maxSteps = 1200, prefix = '' } = {}) {
    const seen = { rounds: 0, end: 0, od: 0, move: 0, ex: 0, pass: 0, odFlag: 0, odHit: 0, follow: 0, link: 0, ender: 0, discard: 0, overlay: 0, timeout: 0, ko: 0, endings: 0, drew: 0, moved: 0 }
    let shotN = 0
    const shot = async name => { if (shots && SHOTS && shotN < 12) { shotN++; await page.screenshot({ path: `${SHOTS}${prefix}${name}.png`, fullPage: true }) } }
    for (let step = 0; step < maxSteps; step++) {
      const t = (await page.locator('main').innerText()).toLowerCase()
      if (await page.locator('.overlay').count()) { seen.overlay++; await page.locator('.overlay .btn').click(); continue }
      if (t.includes('time-out:') && await btn(page, 'Rematch').count()) { seen.timeout++; await shot('09-over'); return seen }
      if (t.includes('k.o.') || t.includes('round limit reached')) { seen.ko++; await shot('09-over'); return seen }
      if (await page.locator('.flag', { hasText: /^Overdrive$/ }).count()) seen.odFlag++
      const narr = (await page.locator('.narr16').allInnerTexts()).join(' ').toLowerCase()
      if (narr.includes('lands in overdrive')) { seen.odHit++; if (seen.odHit === 1) await shot('07-od-hit') }
      if (narr.includes('draws a card')) seen.drew++
      if (narr.includes('the fight moves to')) seen.moved++
      if (t.includes('the fight ends at')) seen.endings++
      const endPanel = page.locator('.hand-wrap h3', { hasText: /^End of round \d+: one option/ })
      if (await endPanel.count()) {
        seen.end++
        if (seen.end === 1) await shot('06-end-of-round')
        const r = step % 4
        const odB = page.locator('.hand-wrap .actions .btn', { hasText: /Overdrive for \d/ })
        const mvB = page.locator('.hand-wrap .actions .btn', { hasText: /^Move the fight to/ })
        const gives = page.locator('.hand-wrap .hand button.card')
        if ((r === 0 || r === 3) && await odB.count()) { seen.od++; await odB.first().click(); continue }
        if (r === 1 && await mvB.count()) { seen.move++; await mvB.first().click(); continue }
        if (r === 2 && await gives.count()) {
          await gives.nth(step % await gives.count()).click()
          await page.waitForTimeout(30)
          const takes = page.locator('.hand-wrap .hand button.card')
          ok(await page.locator('.hand-wrap .label', { hasText: /pick a card to take back/ }).count() === 1, 'the exchange asks what to take back')
          if (seen.ex === 0) await shot('08-exchange')
          ok(await takes.count() > 0, 'the exchange offers a card to take back')
          seen.ex++; await takes.first().click(); continue
        }
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
  ok(B.includes('rules v23'), 'header says rules v23')
  ok(B.includes('a pressure beats a break, a break beats a guard, a guard beats a pressure'), 'the lede gives the triangle')
  ok(B.includes('a guard draws you a card, unless a break beats it'), 'the lede says Guards draw')
  ok(B.includes('overdrive (2 charge') && B.includes('the exchange'), 'the lede names Overdrive and the exchange')
  ok(B.includes('on hit, and on block'), 'the lede explains range endings')
  ok(B.includes(`${BR.hp} hp · charge cap 6`) && B.includes(`${ZO.hp} hp · charge cap 5`), 'the picker shows HP and caps')
  ok(!/\bsuper\b/.test(B) && !/\bspecials?\b/.test(B), 'Setup: no Super or specials')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}01-setup.png`, fullPage: true })

  await page.getByRole('button', { name: 'Decks' }).click()
  await page.waitForTimeout(300)
  const D = await body()
  ok(D.includes('hit or blocked: the fight ends at close'), 'Decks: Dash Punch ends at Close hit or blocked')
  ok(D.includes('on hit: the fight ends at far'), 'Decks: an on-hit ending')
  ok(D.includes("if it beats a pressure, that pressure doesn't move the fight"), 'Decks: Stand Firm')
  ok(!D.includes('problem') && !D.includes('guideline'), 'Decks: the Brawler has no problems or guideline notes')
  ok(D.includes('when revealed: draw a card, unless a break beats it') && D.includes('if a break beats it, it goes back to your hand'), 'Decks: Guard draws and Breakfall')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}02-decks.png`, fullPage: true })
  const DZ = await (async () => { await page.locator('button.fpick', { hasText: 'Zoner' }).first().click(); await page.waitForTimeout(250); return body() })()
  ok(DZ.includes("if it's guarded: the fight ends at close"), "Decks: Dive Kick's on-block ending")
  ok(DZ.includes('if it beats a pressure, build 1 charge'), 'Decks: Evade')
  ok(DZ.includes('on reveal: your pressures get +2 speed next round'), 'Decks: Sidestep')
  ok(!DZ.includes('problem') && !DZ.includes('guideline'), 'Decks: the Zoner has no problems or guideline notes')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForTimeout(200)
  const S = await body()
  ok(S.includes('rules v23') && S.includes('overdrive costs (charge)') && S.includes('moving the fight costs (charge)'), 'Settings: v23 dials')
  ok(!/\bsuper\b/.test(S.replace(/superready/g, '')) && !S.includes('a special costs'), 'Settings: no Super or special dials')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(200)

  await btn(page, 'Start the match').click()
  await page.waitForTimeout(400)
  const H = await body()
  ok(H.includes('0/6') && H.includes('0/5'), 'the HUD shows each Charge cap')
  ok(await page.locator('.range-token').count() === 1, 'the range token shows')
  const total = {}
  for (let g = 0; g < 4; g++) {
    const s = await playGame(page, { shots: g === 0, prefix: '' })
    sum(total, s)
    if (g === 0) ok(/^draw · end-of-round option · pass the initiative$/i.test(s.drawLabel || ''), `the end-of-round button (${s.drawLabel})`)
    await btn(page, 'Rematch').click(); await page.waitForTimeout(300)
  }
  // hot-seat at phone size
  const { page: p2 } = await newPage(390, 844)
  await p2.locator('label', { hasText: /two players|hot-?seat|one device/i }).first().click().catch(() => {})
  await p2.getByRole('button', { name: /^Start/ }).first().click()
  await p2.waitForTimeout(400)
  for (let g = 0; g < 2; g++) {
    const s = await playGame(p2, { shots: g === 0, prefix: 'phone-' })
    sum(total, s)
    if (await btn(p2, 'Rematch').count()) { await btn(p2, 'Rematch').click(); await p2.waitForTimeout(300) }
  }
  console.log(total)
  ok(total.ko + total.timeout === 6, `six games finished (${total.ko} KOs, ${total.timeout} time-outs)`)
  ok(total.end > 10, `the end-of-round panel showed (${total.end})`)
  ok(total.od > 0 && total.odFlag > 0, `Overdrive was chosen (${total.od}) and flagged (${total.odFlag})`)
  ok(total.odHit > 0, `a hit in Overdrive was narrated (${total.odHit})`)
  ok(total.ex > 0, `the exchange was used (${total.ex})`)
  ok(total.move > 0, `the fight was moved with Charge (${total.move})`)
  ok(total.drew > 0, `Guard draws were narrated (${total.drew})`)
  ok(total.endings > 0, `range endings showed on cards (${total.endings})`)
  ok(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`)
  console.log(`${checks - fails}/${checks} pass`)
  await browser.close()
  process.exit(fails ? 1 : 0)
})()
