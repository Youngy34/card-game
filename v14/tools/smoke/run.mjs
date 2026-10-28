// Click-through test of the built rules v14 page in a fake DOM.
//
//   node v14/tools/build-artifact.mjs
//   node --import ./tools/smoke/register.mjs v14/tools/smoke/run.mjs <vendor dir>
//
// Reuses the v11/v12 app's fake DOM and module hook (tools/smoke/). <vendor dir>
// holds Preact 10.24.3 and htm 3.1.1 source (git clones at their release tags),
// laid out as pkg/preact (src, hooks/src) and pkg/htm (src), plus a
// node_modules/preact that re-exports pkg/preact/src/index.js (Preact's hooks
// import 'preact' by name).

import fs from 'fs'
import vm from 'vm'
import path from 'path'
import { fileURLToPath } from 'url'
import { installDom, all, find, byText, cls } from '../../../tools/smoke/fake-dom.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const vendor = process.argv[2]
const errors = []
const origErr = console.error
console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr(...a) }
process.on('unhandledRejection', e => { errors.push('unhandled: ' + (e?.stack || e)); origErr(e) })

const document = installDom()
const app = document.createElement('div'); app.setAttribute('id', 'app'); document.body.appendChild(app)
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true })
globalThis.preact = await import(`${vendor}/pkg/preact/src/index.js`)
globalThis.preactHooks = await import(`${vendor}/pkg/preact/hooks/src/index.js`)
globalThis.htm = (await import(`${vendor}/pkg/htm/src/index.mjs`)).default

const page = fs.readFileSync(path.join(root, 'dist/yomi-playtest-v14.html'), 'utf8')
const script = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'))
vm.runInThisContext(script, { filename: 'yomi-playtest-v14.html' })

const wait = (ms = 120) => new Promise(r => setTimeout(r, ms))
const text = () => app.textContent
let checks = 0, fails = 0
const ok = (cond, what) => { checks++; if (!cond) { fails++; console.log('FAIL:', what) } }
const button = label => {
  const bs = byText(app, 'button', label).filter(b => !b.disabled)
  return bs.find(b => b.textContent.trim() === label) || bs[0]
}
async function click(label) {
  const b = typeof label === 'string' ? button(label) : label
  if (!b) throw new Error(`no enabled button "${label}"\n${errors.slice(0, 3).join("\n")}\n${text().slice(0, 300)}`)
  b.dispatch('click'); await wait()
}
async function setValue(el, v, ev = 'input') { el.value = v; el.checked = v; el.dispatch(ev); await wait() }
const byId = id => find(app, n => n.attributes.id === id)
const cards = () => all(app, n => n.localName === 'button' && cls(n, 'card') && !n.disabled && !cls(n, 'add-card'))

// Play one whole match by clicking: a playable card (rotating), Lock in, Next reveal.
// Returns the number of reveals.
async function playOut(limit, onReveal) {
  let n = 0
  for (let steps = 0; steps < limit * 4 && n < limit; steps++) {
    if (/Game over/.test(text())) break
    if (button('Next reveal')) { await click('Next reveal'); continue }
    const pass = byText(app, 'button', "I'm Player").find(b => !b.disabled)
    if (pass) { await click(pass); continue }
    if (!byText(app, 'button', 'Lock in').length) break
    const cs = cards()
    if (!cs.length) break
    cs[(steps * 7) % cs.length].dispatch('click'); await wait(30)
    onReveal?.('pick')
    await click('Lock in')
    n++
    onReveal?.('reveal')
  }
  return n
}

await wait(300)
ok(text().includes('Fight night'), 'setup screen renders')
ok(text().includes('This browser only'), 'falls back to browser storage outside claude.ai')
ok(['Vex', 'Atlas', 'Benchmark'].every(n => byText(app, 'button', n).length >= 2), 'fighter pickers list Vex, Atlas and Benchmark')
ok(text().includes('Rules as written'), 'setup says the rules are as written')
ok(/Strike.*Heavy.*Grab.*Focus.*Block/.test(text()) && text().includes('Each beats the next two'), 'setup shows the wheel in order')

// ---- a full match against the sparring partner, on Easy, with hints and the odds ----
await click('Easy')
await setValue(byId('odds'), true, 'change')
ok(byId('hints').checked, 'reading hints are on by default')
await click('Start the match')
ok(text().includes('Your pick'), 'match starts with your pick')
ok(text().includes('Sparring partner · Easy'), 'the table shows the difficulty')
ok(/Reveal 1/.test(text()), 'phase bar shows the first reveal')
ok(text().includes('classic triangle'), 'the opening hint explains the triangle')
ok(text().includes('Beats Heavy and Grab') && text().includes('Beats Strike and Heavy'), 'card faces say what they beat')
ok(text().includes('Wins: 1 grey on their pile, then 2 chip.'), "Flick Cut's face is written from its numbers")
let sawMix = false, sawCooling = false, sawNoType = false
const played = await playOut(150, kind => {
  if (text().includes('The unexploitable mix')) sawMix = true
  if (kind === 'pick' && text().includes('is cooling down')) sawCooling = true
  if (/No (Strike|Heavy|Grab|Focus|Block)/.test(text())) sawNoType = true
})
ok(played > 0, `played ${played} reveals`)
ok(sawMix, 'the mix is shown after a reveal')
ok(sawCooling, 'hints explain what a cooling-down type means')
ok(sawNoType, 'the HUD flags a type a player is missing')
await wait(300)
const over = /Game over/.test(text())
ok(over, 'the match ends')
if (over) ok(text().includes('Saved to the playtest log'), 'finished game is logged')
console.log(`  (match: ${played} reveals, over ${over})`)

// ---- the log ----
if (over) {
  await click('Playtest log')
  ok(text().includes('Vex vs Atlas'), 'the log lists the game')
  await click('Reveals')
  ok(/wins · |Cancel/.test(text()), "the game's reveals show")
}

// ---- move lists: edit, save, reset ----
await click('Move lists')
ok(text().includes('Flick Cut') && text().includes('Hilt Hook') && text().includes('Poise'), "Vex's cards show")
const flick = find(app, n => n.localName === 'button' && n.attributes['aria-label'] === 'Edit Flick Cut')
flick.dispatch('click'); await wait()
await setValue(byId('c-chip'), '3')
ok(text().includes('Unsaved changes'), 'an edit marks the fighter unsaved')
ok(text().includes('Chip 2 → 3'), 'the change is listed against the draft')
await click('Save')
await wait(200)
ok(text().includes('Edited'), 'the saved fighter is marked Edited')
await click('Reset to the draft')
await click('Reset')
await wait(200)
ok(!byText(app, 'span', 'Edited').length, 'reset clears the edit')
// a validation problem blocks saving
await click('JSON')
const ta = byId('json')
await setValue(ta, ta.value.replace('"type": "focus",', '"type": "focus", "chip": 1,'))
ok(text().includes('never deals damage'), 'validation catches chip on a Focus')
ok(byText(app, 'button', 'Save').every(b => b.disabled), 'save is blocked while there are problems')
await click('Discard changes')

// ---- settings: experiments ----
await click('Settings')
await setValue(byId('s-mirrors'), 'all', 'change')
await setValue(byId('s-wheel'), 'alt', 'change')
await click('Save settings')
await wait(200)
await click('Play')
if (button('New match')) await click('New match')
ok(text().includes('Experiments on:') && text().includes('mirrors take effect') && text().includes('alternative wheel'), 'setup shows the experiments that are on')
ok(/Focus.*Strike.*Grab.*Heavy.*Block/.test(text()), 'the wheel follows the experiment')

// ---- a hot-seat match under the experiments, played to the end ----
await click('Two players, one device')
await click('Start the match')
ok(text().includes("Player 1's pick"), 'hot seat starts with player 1')
ok(text().includes('Beats Heavy and Block'), "card faces follow the wheel (Grab beats Heavy and Block on the alternative)")
const hs = await playOut(200)
await wait(300)
ok(/Game over/.test(text()), `the hot-seat match ends (${hs} reveals)`)
ok(text().includes('Saved to the playtest log'), 'the hot-seat game is logged')

// ---- the Lab ----
await click('Settings')
await click('Turn all off')
await click('Save settings')
await wait(200)
await click('Lab')
await click('50')
await click('Run this matchup')
for (let i = 0; i < 300 && !text().includes('The squeeze'); i++) await wait(200)
ok(text().includes('The squeeze'), 'the Lab report appears with the squeeze table')
ok(text().includes('Which type wins reveals') && text().includes('Damage by type') && text().includes('How games end'), 'the report shows the playtest targets')
ok(text().includes('rules as written'), 'the report records the rules')

console.log(`${checks - fails} / ${checks} checks passed${errors.length ? ` · ${errors.length} console errors` : ''}`)
if (errors.length) console.log(errors.slice(0, 5).join('\n'))
process.exit(fails || errors.length ? 1 : 0)
