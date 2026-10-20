// Click-through test of the published page in a fake DOM.
//
//   node --import ./tools/smoke/register.mjs tools/smoke/run.mjs <vendor dir>
//
// <vendor dir> holds Preact 10.24.3 and htm 3.1.1 source (git clones), laid
// out as pkg/preact (src, hooks/src) and pkg/htm (src). Runs the built page
// (dist/yomi-playtest.html), so build it first.

import fs from 'fs'
import vm from 'vm'
import path from 'path'
import { fileURLToPath } from 'url'
import { installDom, all, find, byText, cls } from './fake-dom.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const vendor = process.argv[2]
const errors = []
const origErr = console.error
console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr(...a) }
process.on('unhandledRejection', e => { errors.push('unhandled: ' + (e?.stack || e)); origErr(e) })

const document = installDom()
const app = document.createElement('div'); app.setAttribute('id', 'app'); document.body.appendChild(app)
Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true })
globalThis.preact = await import(`${vendor}/pkg/preact/src/index.js`)
globalThis.preactHooks = await import(`${vendor}/pkg/preact/hooks/src/index.js`)
globalThis.htm = (await import(`${vendor}/pkg/htm/src/index.mjs`)).default

const page = fs.readFileSync(path.join(root, 'dist/yomi-playtest.html'), 'utf8')
const script = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'))
vm.runInThisContext(script, { filename: 'yomi-playtest.html' })

const wait = (ms = 160) => new Promise(r => setTimeout(r, ms))
const text = () => app.textContent
let checks = 0, fails = 0
const ok = (cond, what) => { checks++; if (!cond) { fails++; console.log('FAIL:', what) } }
const button = label => {
  const bs = byText(app, 'button', label).filter(b => !b.disabled)
  return bs.find(b => b.textContent.trim() === label) || bs[0]
}
async function click(label) {
  const b = typeof label === 'string' ? button(label) : label
  if (!b) throw new Error(`no enabled button "${label}"\n${text().slice(0, 600)}`)
  b.dispatch('click'); await wait()
}
async function setValue(el, v, ev = 'input') { el.value = v; el.checked = v; el.dispatch(ev); await wait() }
const byId = id => find(app, n => n.attributes.id === id)

await wait(300)
ok(text().includes('Fight night'), 'setup screen renders')
ok(text().includes('This browser only'), 'falls back to browser storage outside claude.ai')
ok(byText(app, 'button', 'Bastion').length >= 2, 'fighter pickers list Bastion')

// ---- a full match against the sparring partner ----
await click('Start the match')
ok(text().includes('Your pick'), 'match starts with your pick')
ok(text().includes('Dead to a Convert') === false, 'no lethal flag at the start')
let rounds = 0
while (!text().includes('K.O.') && !text().includes('Draw') && rounds < 60) {
  const cards = all(app, n => n.localName === 'button' && cls(n, 'card') && !n.disabled)
  ok(cards.length > 0, `round ${rounds + 1}: some card is playable`)
  cards[rounds % cards.length].dispatch('click'); await wait(40)
  await click('Lock in')
  ok(/beats|mirror|Both resolve/.test(text()), `round ${rounds + 1}: outcome shown`)
  rounds++
  if (button('Next round')) await click('Next round')
}
ok(text().includes('K.O.') || text().includes('Draw'), `match ends (${rounds} rounds)`)
await wait(300)
ok(text().includes('Saved to the playtest log'), 'finished game is logged')

// ---- the log ----
await click('Playtest log')
ok(text().includes('Games') && text().includes('vs sparring partner'), 'log lists the game')
await click('Rounds')
ok(text().includes('Outcome'), 'log shows the rounds of a game')

// ---- hot-seat ----
await click('Play'); await click('New match')
await click('Two players, one device')
await click('Start the match')
ok(text().includes("Player 1's pick"), 'hot-seat starts with player 1')
all(app, n => n.localName === 'button' && cls(n, 'card') && !n.disabled)[0].dispatch('click'); await wait(40)
await click('Lock in')
ok(text().includes('has locked in'), 'pass screen hides the first pick')
await click("I'm Player 2")
ok(text().includes("Player 2's pick"), 'player 2 picks next')
all(app, n => n.localName === 'button' && cls(n, 'card') && !n.disabled)[1].dispatch('click'); await wait(40)
await click('Lock in')
ok(/beats|mirror|Both resolve/.test(text()), 'hot-seat round resolves')
await click('Leave this match')

// ---- watch ----
await click('Watch the sparring partner')
await click('Start the match')
await click('Reveal')
ok(/beats|mirror|Both resolve/.test(text()), 'watch mode reveals a round')
await click('Leave this match')
await click('You vs sparring partner')

// ---- move lists ----
await click('Move lists')
ok(text().includes('Let It Ride') && text().includes('+2 Build if the opponent already has 4 or more tokens.'), 'Gambler cards render with generated text')
await click(byText(app, 'button', 'Bastion').find(b => cls(b, 'fpick')))
ok(text().includes("If it beats a Convert, the opponent can't play a Convert next round."), 'Rim Shot text generated')
ok(text().includes("On cooldown: you can't play another Pressure."), 'Rim Shot cost generated')
await click(find(app, n => n.localName === 'button' && n.attributes['aria-label'] === 'Edit Rim Shot'))
ok(text().includes('Card · Rim Shot'), 'card editor opens')
await setValue(byId('c-chip'), '2')
ok(text().includes('Unsaved changes'), 'edit marks the fighter unsaved')
ok(text().includes('Rim Shot: Chip 0 → 2'), 'diff lists the change')
await click('Save')
await wait(200)
ok(byText(app, 'span', 'Edited').length > 0, 'saved edit shows as Edited')
await setValue(byId('c-type'), 'recover', 'change')
ok(text().includes('Removed what a recover card can'), 'type change strips what no longer fits')
await click('Discard changes')
await click('Reset to signed off')
await click('Reset')
await wait(200)
ok(!text().includes('Changes from the signed-off version'), 'reset brings back the signed-off version')
// a typo in raw JSON is caught
await click('JSON')
const ta = byId('json')
const f = JSON.parse(ta.value); f.cards[0].chp = 3
await setValue(ta, JSON.stringify(f, null, 2))
ok(text().includes('Unknown field "chp" (did you mean "chip"?)'), 'JSON typo is caught with a suggestion')
await setValue(ta, '{ not json')
ok(text().includes("That isn't valid JSON yet"), 'invalid JSON is reported')
await click('Discard changes')
await click('Cards')
await click('Duplicate as variant')
await wait(200)
ok(text().includes('Bastion v2'), 'duplicate makes a variant')

// ---- lab ----
await click('Lab')
await click(byText(app, 'button', '100').find(b => b.parentNode && cls(b.parentNode, 'seg')))
await click('Run this matchup')
for (let i = 0; i < 100 && !text().includes('Median length'); i++) await wait(100)
ok(text().includes('Median length') && text().includes('Share of plays'), 'Lab report renders')
await click('Run every matchup')
for (let i = 0; i < 600 && !text().includes('Every matchup'); i++) await wait(100)
ok(text().includes('Every matchup') && text().includes('Average'), 'round-robin renders')

// ---- settings ----
await click('Settings')
await setValue(byId('s-counter'), 'attack', 'change')
await click('Save settings')
await wait(100)
ok(text().includes('Back to defaults'), 'settings save')
await click('Back to defaults')

ok(errors.length === 0, `no console errors (${errors.length})`)
console.log(`${checks} checks, ${fails} failed`)
if (errors.length) console.log(errors.slice(0, 5).join('\n'))
process.exit(fails ? 1 : 0)
