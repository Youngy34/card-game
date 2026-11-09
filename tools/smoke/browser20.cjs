// Real-browser click-through (Playwright and Chromium) of the built v20 page (rules v20: heat), with Preact and htm
// served from local source clones (the CDN isn't reachable from here). Plays whole games against the partner and
// between two players on one device, answering every prompt, the end-of-round shop included.
// usage: node tools/smoke/browser20.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir>: pkg/preact and pkg/htm source clones.
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const PAGE = process.argv[2] || 'dist/yomi-playtest-v20.html'
const DATA = n => JSON.parse(fs.readFileSync(path.join(__dirname, `../../data/v20/${n}.json`), 'utf8'))
const BM = DATA('benchmark'), AT = DATA('atlas')
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/v20/settings.json'), 'utf8')).rules
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

  async function playGame(page, { shots = false, maxSteps = 900, prefix = '' } = {}) {
    const seen = { rounds: 0, buy: 0, bought: 0, boughtSuper: 0, follow: 0, link: 0, end: 0, discard: 0, confiscate: 0, pass: 0, heatLines: 0, greyLines: 0, maxNote: 0, maxFlag: 0, timeout: 0, ko: 0, superPlayed: 0 }
    let shotN = 0
    const shot = async name => { if (shots && SHOTS && shotN < 10) { shotN++; await page.screenshot({ path: `${SHOTS}${prefix}${name}.png`, fullPage: true }) } }
    for (let step = 0; step < maxSteps; step++) {
      const t = (await page.locator('main').innerText()).toLowerCase()
      if (await page.locator('.overlay').count()) { seen.pass++; await page.locator('.overlay .btn').click(); continue }
      if (t.includes('time-out:') && await btn(page, 'Rematch').count()) { seen.timeout++; await shot('09-over'); return seen }
      if (t.includes('k.o.') || t.includes('round limit reached')) { seen.ko++; await shot('09-over'); return seen }
      if (t.includes('max: more heat lands as damage')) seen.maxFlag++
      if (t.includes("you're at max heat") || t.includes('is at max heat (')) seen.maxNote++
      const narr = (await page.locator('.narr16').allInnerTexts()).join(' ').toLowerCase()
      if (narr.includes(' heat')) seen.heatLines++
      if (/\bgrey\b/.test(narr)) seen.greyLines++
      if (narr.includes('plays their super')) seen.superPlayed++
      const rider = page.locator('.hand-wrap h3', { hasText: /: (read|recall)$/i })
      if (await rider.count()) {
        seen.rider = (seen.rider || 0) + 1
        const h = (await rider.first().innerText()).toLowerCase()
        ok(h.endsWith('recall'), `only Recall asks at the reveal (Read just draws): ${h}`)
        const cards = page.locator('.hand-wrap .hand button.card'), bs = page.locator('.hand-wrap .actions .btn')
        const nc = await cards.count(), nb = await bs.count()
        if (nc && (step % 2 || !nb)) await cards.nth(step % nc).click(); else await bs.first().click()
        continue
      }
      const shop = page.locator('.hand-wrap h3', { hasText: /^Spend heat/ })
      if (await shop.count()) {
        seen.buy++
        if (seen.buy === 1) await shot('06-shop')
        const cards = page.locator('.hand-wrap .hand button.card')
        const nc = await cards.count()
        ok(nc > 0, 'the shop offers at least one card')
        if (nc && step % 2 === 0) {
          const sup = await cards.last().getAttribute('aria-label')
          if (sup && sup.includes('Super')) seen.boughtSuper++
          seen.bought++; await cards.nth(nc - 1).click()
        } else await page.locator('.hand-wrap .actions .btn', { hasText: /^Keep your heat/ }).click()
        continue
      }
      if (await btn(page, 'Lock in').count()) {
        if (seen.rounds === 1) await shot('03-clash-pick')
        const cards = page.locator('.hand button.card:not([disabled])')
        const n = await cards.count()
        ok(n > 0, 'some clash card is playable')
        // play the Super when it's there, otherwise vary
        const sup = page.locator('.hand button.card.super:not([disabled])')
        if (await sup.count() && step % 2) await sup.first().click(); else await cards.nth(step % n).click()
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
        const h = (await page.locator('.hand-wrap h3').first().innerText()).toLowerCase()
        if (h.startsWith('confiscate')) seen.confiscate++; else seen.discard++
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
  ok(B.includes('rules v20'), 'header says rules v20')
  ok(B.includes('pressure beats a break, a break beats a guard, a guard beats a pressure'), 'the lede gives the triangle in the new names')
  ok(B.includes(`${BM.hp} hp · heat cap ${BM.greyCap} · 26 cards + 2 specials`), `the picker shows the Benchmark's HP ${BM.hp} and heat cap ${BM.greyCap}`)
  ok(B.includes(`${AT.hp} hp · heat cap ${AT.greyCap}`), 'Atlas shows his heat cap')
  ok(!B.includes('meter track'), 'no meter track in the rules line')
  ok(B.includes('specials 3 heat, the super your whole cap'), 'the rules line prices the table in heat')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}01-setup.png`, fullPage: true })

  // Decks: card faces in the new names
  await page.getByRole('button', { name: 'Decks' }).click()
  await page.waitForTimeout(300)
  const D = await body()
  ok(D.includes('break · heavy') || D.includes('break · grab'), 'Decks: Converts read Break (Heavy or Grab)')
  ok(D.includes('guard · block'), 'Decks: the core reads Guard · Block')
  ok(D.includes('on reveal: draw a card.'), "Decks: Read just draws")
  ok(!D.includes('paying its meter'), 'Decks: no meter on Read')
  ok(D.includes('buy it from the table for 3 heat'), 'Decks: specials cost 3 heat')
  ok(D.includes('all your heat: buy it at max heat'), 'Decks: the Super costs all your heat')
  ok(!D.includes('charge'), 'Decks: no Charge in the core')
  ok(D.includes('heat cap'), 'Decks: the cap reads as a heat cap')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}02-decks.png`, fullPage: true })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForTimeout(200)
  const S = await body()
  ok(S.includes('a special costs (heat)'), 'Settings: the special price in heat')
  ok(!S.includes('meter track maximum'), 'Settings: no meter track')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(200)

  // a game against the partner
  await btn(page, 'Start the match').click()
  await page.waitForTimeout(400)
  const H = await body()
  ok(H.includes('heat') && H.includes(`0/${BM.greyCap}`), 'the HUD shows heat out of the cap')
  ok(!(await page.locator('.meter').count()), 'no meter track on the HUD')
  ok(H.includes('rising strike · 3 heat'), 'the table prices a special in heat')
  ok(H.includes(`overdrive · ${BM.greyCap} heat (max)`), 'the table prices the Super at the cap')
  const total = {}
  for (let g = 0; g < 3; g++) {
    const s = await playGame(page, { shots: g === 0, prefix: '' })
    sum(total, s)
    if (g === 0) ok(/^draw · 1 heat each · spend heat · pass the initiative$/i.test(s.drawLabel || ''), `the end-of-round button names the shop (${s.drawLabel})`)
    await btn(page, 'Rematch').click(); await page.waitForTimeout(300)
  }
  console.log('vs partner, 3 games:', JSON.stringify(total))
  ok(total.rounds > 20, 'rounds were played')
  ok(total.heatLines > 0, 'the narration talks about heat')
  ok(total.greyLines === 0, 'the narration never says grey')
  ok(total.buy > 0, 'the shop came up')
  ok(total.bought > 0, 'a card was bought')
  ok(total.follow + total.link + total.end > 0, 'follow-ups or combos came up')

  // two players, one device (hot seat): passing, and the shop for both
  await btn(page, 'Leave this match').click().catch(() => {})
  await page.getByRole('button', { name: 'Leave this match' }).count().then(n => n ? page.getByRole('button', { name: 'Leave this match' }).click() : null)
  await page.waitForTimeout(200)
  if (await page.getByRole('button', { name: 'New match' }).count()) await page.getByRole('button', { name: 'New match' }).click()
  await page.getByRole('radio', { name: 'Two players, one device' }).click().catch(async () => { await page.getByText('Two players, one device').click() })
  await btn(page, 'Start the match').click()
  const hs = await playGame(page, { shots: !!SHOTS, prefix: 'hotseat-' })
  console.log('hot seat, 1 game:', JSON.stringify(hs))
  ok(hs.pass > 0, 'hot seat: the device changes hands')
  ok(hs.buy > 0, 'hot seat: the shop came up')

  // a phone-sized screen
  const { page: p2 } = await newPage(390, 844)
  await btn(p2, 'Start the match').click()
  await p2.waitForTimeout(300)
  const w = await p2.evaluate(() => document.documentElement.scrollWidth)
  ok(w <= 392, `phone: no sideways scroll (${w}px)`)
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}07-phone.png`, fullPage: true })

  ok(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`)
  console.log(`${checks - fails}/${checks} checks pass`)
  await browser.close()
  process.exit(fails ? 1 : 0)
})()
