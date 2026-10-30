// Real-browser click-through (Playwright and Chromium) of the built v15 page, with Preact and htm served
// from local source clones (the CDN isn't reachable from here).
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
// usage: node tools/smoke/browser15.cjs <built page> <vendor dir> [screenshot dir]
// <vendor dir> as for run.mjs: pkg/preact and pkg/htm source clones.
const PAGE = process.argv[2] || 'dist/yomi-playtest-v15.html'
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
  const { page } = await newPage(1280, 900)
  const body = async () => (await page.locator('body').innerText()).toLowerCase()
  ok((await body()).includes('rules v15'), 'header says rules v15')
  ok((await page.locator('.fpick[aria-pressed="true"]').allInnerTexts()).every(t => t.includes('BENCHMARK') || t.includes('Benchmark')), 'Benchmark is picked on both sides by default')
  ok((await body()).includes('untuned port'), 'ports are labelled untuned')
  ok((await body()).includes('a recover that beats a pressure earns a free follow-up attack'), 'setup states the payoff')
  SHOTS && await page.screenshot({ path: SHOTS + '01-setup.png', fullPage: true })

  await page.getByRole('button', { name: 'Start the match' }).click()
  await page.waitForSelector('text=Your pick')
  ok(await page.locator('.notes li').count() > 0, 'board notes show while picking')
  SHOTS && await page.screenshot({ path: SHOTS + '02-pick.png', fullPage: true })

  let round = 0, followSeen = 0, followShot = false, revealShot = false
  while (round < 120) {
    const t = await body()
    if (t.includes('k.o.') || /\bdraw\b/.test(t)) { break }
    if (await page.getByRole('button', { name: 'No follow-up' }).count()) {
      followSeen++
      if (!followShot) { SHOTS && await page.screenshot({ path: SHOTS + '03-follow.png', fullPage: true }); followShot = true }
      ok(await page.locator('.followup-ask').count() === 1, 'follow-up prompt shows in the clash')
      const cards = page.locator('.hand button.card')
      ok(await cards.count() > 0, 'follow-up candidates listed')
      if (followSeen % 3 === 0) await page.getByRole('button', { name: 'No follow-up' }).click()
      else { await cards.first().click(); await page.getByRole('button', { name: 'Follow up', exact: true }).click() }
      if (followSeen % 3 !== 0 && !revealShot) {
        await page.waitForTimeout(100)
        ok(await page.locator('.followup .card').count() === 1, 'the follow-up card shows after resolving')
        SHOTS && await page.screenshot({ path: SHOTS + '04-followed.png', fullPage: true }); revealShot = true
      }
    } else if (await page.getByRole('button', { name: 'Next round' }).count()) {
      await page.getByRole('button', { name: 'Next round' }).click()
    } else {
      const cards = page.locator('.hand button.card:not([disabled])')
      const n = await cards.count()
      ok(n > 0, `round ${round + 1}: a card is playable`)
      // lean on Recovers so follow-ups come up
      const labels = await cards.evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') || ''))
      const rec = labels.findIndex(l => l.includes('Recover'))
      const k = rec >= 0 && round % 2 === 0 ? rec : round % n
      await cards.nth(k).click()
      await page.getByRole('button', { name: 'Lock in' }).click()
      round++
    }
    await page.waitForTimeout(30)
  }
  const end = await body()
  ok(end.includes('k.o.') || end.includes('draw'), `match ends (${round} picks, ${followSeen} follow-up choices)`)
  ok(followSeen > 0, 'at least one follow-up choice came up')
  await page.waitForTimeout(400)
  ok((await body()).includes('saved to the playtest log'), 'game is logged')
  SHOTS && await page.screenshot({ path: SHOTS + '05-ko.png', fullPage: true })

  // log
  await page.getByRole('button', { name: 'Playtest log' }).click()
  await page.waitForSelector('text=Games')
  await page.getByRole('button', { name: 'Rounds' }).first().click()
  ok((await body()).includes('follow-up') || followSeen % 3 === 0, 'log rounds mention follow-ups')
  SHOTS && await page.screenshot({ path: SHOTS + '06-log.png', fullPage: true })

  // lab
  await page.getByRole('button', { name: 'Lab' }).click()
  await page.getByRole('button', { name: '100', exact: true }).click()
  await page.getByRole('button', { name: 'Run this matchup' }).click()
  await page.waitForSelector('text=Recover beats Pressure', { timeout: 60000 })
  ok((await body()).includes('quiet rounds by cause'), 'Lab shows v15 tiles')
  ok(!(await body()).includes('double kos'), 'Lab hides double KOs for v15')
  SHOTS && await page.screenshot({ path: SHOTS + '07-lab.png', fullPage: true })
  await page.getByRole('button', { name: 'Run every matchup' }).click()
  await page.waitForSelector('text=Every matchup', { timeout: 120000 })
  ok((await body()).includes('vs vex'), 'round-robin covers the ports')

  // settings
  await page.getByRole('button', { name: 'Settings' }).click()
  ok(await page.locator('#s-payoff').count() === 1, 'payoff setting shows')
  ok(await page.locator('#s-counter').count() === 0, 'v11 counter-chip setting is hidden')
  await page.selectOption('#s-payoff', 'fixed')
  ok(await page.locator('#s-fixed').count() === 1, 'fixed damage field appears')
  await page.locator('#s-projsafe').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await page.waitForTimeout(200)
  SHOTS && await page.screenshot({ path: SHOTS + '08-settings.png', fullPage: true })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  if (await page.getByRole('button', { name: 'New match' }).count()) await page.getByRole('button', { name: 'New match' }).click()
  ok((await body()).includes('deals fixed damage to the attacker (2), except against a projectile'), 'setup reflects saved settings')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Back to defaults' }).click()
  await page.waitForTimeout(200)

  // move lists
  await page.getByRole('button', { name: 'Move lists' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Benchmark/ }).first().click().catch(() => {})
  await page.waitForTimeout(200)
  const edit = page.getByRole('button', { name: 'Edit Block' })
  if (await edit.count()) {
    await edit.click()
    const opts = await page.locator('#c-kind option').allInnerTexts()
    ok(opts.join() === 'Block,Dodge', `Recover kinds are Block and Dodge (${opts.join()})`)
    ok((await body()).includes('you may follow up with an attack from your hand'), 'v15 Recover line shows in the editor')
  } else ok(false, 'Benchmark Block card is editable')
  SHOTS && await page.screenshot({ path: SHOTS + '09-movelist.png', fullPage: true })

  // the Reader: remembers earlier games and shows its read after each reveal
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  if (await page.getByRole('button', { name: 'New match' }).count()) await page.getByRole('button', { name: 'New match' }).click()
  await page.getByRole('button', { name: 'Reader', exact: true }).click()
  const memText = (await page.locator('label.check', { hasText: 'remember my habits' }).innerText()).toLowerCase()
  ok(/\(\d+ logged games? against the partner on these rules\)/.test(memText), `Reader offers memory of logged games (${memText})`)
  await page.getByRole('button', { name: 'Start the match' }).click()
  await page.waitForSelector('text=Your pick')
  ok((await body()).includes('sparring partner · reader'), 'the table names the Reader')
  let readSeen = false, readText = ''
  for (let r = 0; r < 120; r++) {
    const t = await body()
    if (t.includes('k.o.')) break
    if (await page.locator('.readline').count()) {
      if (!readSeen && SHOTS) await page.locator('.clash').screenshot({ path: SHOTS + '12-reader.png' })
      readSeen = true; readText = (await page.locator('.readline').innerText()).toLowerCase()
    }
    if (await page.getByRole('button', { name: 'No follow-up' }).count()) await page.getByRole('button', { name: 'No follow-up' }).click()
    else if (await page.getByRole('button', { name: 'Next round' }).count()) await page.getByRole('button', { name: 'Next round' }).click()
    else {
      const cards = page.locator('.hand button.card:not([disabled])')
      const labels = await cards.evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') || ''))
      const rec = labels.findIndex(l => l.includes('Recover'))
      await cards.nth(rec >= 0 ? rec : 0).click()
      await page.getByRole('button', { name: 'Lock in' }).click()
    }
    await page.waitForTimeout(30)
    if (readSeen && r > 6) break
  }
  ok(readSeen, "the Reader's read shows after a reveal")
  ok(readText.includes('it expected you to play'), `the read names what it expected (${readText.slice(0, 120)})`)
  await page.getByRole('button', { name: 'Leave this match' }).click()

  // the split Benchmark: Block gives frame advantage instead of a follow-up
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  if (await page.getByRole('button', { name: 'New match' }).count()) await page.getByRole('button', { name: 'New match' }).click()
  if (await page.getByRole('button', { name: 'Leave this match' }).count()) await page.getByRole('button', { name: 'Leave this match' }).click()
  await page.getByRole('button', { name: 'Hard', exact: true }).click()
  for (const k of [0, 1]) await page.locator('.pickers .fighters').nth(k).getByRole('button', { name: /Split Benchmark/ }).click()
  await page.getByRole('button', { name: 'Start the match' }).click()
  await page.waitForSelector('text=Your pick')
  ok((await body()).includes('frame advantage. you win any speed duel next round'), 'Block prints frame advantage on its face')
  let sawFrame = false, sawFlag = false, splitFollow = 0
  for (let r = 0; r < 80; r++) {
    const t = await body()
    if (t.includes('k.o.')) break
    if (t.includes('gains frame advantage')) sawFrame = true
    if (await page.locator('.flag.frame').count()) sawFlag = true
    if (await page.getByRole('button', { name: 'No follow-up' }).count()) {
      splitFollow++
      ok((await page.locator('.followup-ask').count()) === 1, 'Dodge still earns a follow-up')
      await page.getByRole('button', { name: 'No follow-up' }).click()
    } else if (await page.getByRole('button', { name: 'Next round' }).count()) await page.getByRole('button', { name: 'Next round' }).click()
    else {
      const cards = page.locator('.hand button.card:not([disabled])')
      const labels = await cards.evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') || ''))
      const blk = labels.findIndex(l => l.startsWith('Block'))
      await cards.nth(blk >= 0 ? blk : r % labels.length).click()
      await page.getByRole('button', { name: 'Lock in' }).click()
    }
    await page.waitForTimeout(30)
    if (sawFrame && sawFlag) break
  }
  ok(sawFrame, 'a Block win gives frame advantage')
  ok(sawFlag, 'the HUD flags frame advantage')
  SHOTS && await page.screenshot({ path: SHOTS + '11-frame.png', fullPage: true })

  // phone width
  const ph = await newPage(390, 844)
  await ph.page.getByRole('button', { name: 'Start the match' }).click()
  await ph.page.waitForSelector('text=Your pick')
  const sw = await ph.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  ok(sw[0] <= sw[1], `no horizontal scroll at phone width (${sw})`)
  SHOTS && await ph.page.screenshot({ path: SHOTS + '10-phone.png', fullPage: true })

  console.log(`${checks - fails}/${checks} checks passed`)
  if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 10).join('\n'))
  await browser.close()
  process.exit(fails || errors.length ? 1 : 0)
})()
