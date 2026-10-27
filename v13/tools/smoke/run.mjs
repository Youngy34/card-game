// Click-through test of the built rules v13 page in a fake DOM.
//
//   node v13/tools/build-artifact.mjs
//   node --import ./tools/smoke/register.mjs v13/tools/smoke/run.mjs <vendor dir>
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

const page = fs.readFileSync(path.join(root, 'dist/yomi-playtest-v13.html'), 'utf8')
const script = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'))
vm.runInThisContext(script, { filename: 'yomi-playtest-v13.html' })

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

// Play one whole match by clicking: a playable card (rotating), Lock in, any
// counter, Next reveal. Returns the number of reveals.
async function playOut(limit, onReveal) {
  let n = 0
  for (let steps = 0; steps < limit * 4 && n < limit; steps++) {
    if (/Game over/.test(text())) break
    if (button('Next reveal')) { await click('Next reveal'); continue }
    const pass = byText(app, 'button', "I'm Player").find(b => !b.disabled)
    if (pass) { await click(pass); continue }
    if (button("Don't counter")) {
      const cs = cards()
      if (cs.length && steps % 2 === 0) { cs[0].dispatch('click'); await wait(30); await click('Counter') }
      else await click("Don't counter")
      onReveal?.('counter')
      continue
    }
    if (!byText(app, 'button', 'Lock in').length) break
    const cs = cards()
    if (!cs.length) break
    cs[(steps * 7) % cs.length].dispatch('click'); await wait(30)
    await click('Lock in')
    n++
    onReveal?.('reveal')
  }
  return n
}

await wait(300)
ok(text().includes('Fight night'), 'setup screen renders')
ok(text().includes('This browser only'), 'falls back to browser storage outside claude.ai')
ok(byText(app, 'button', 'Vex').length >= 2 && byText(app, 'button', 'Atlas').length >= 2, 'fighter pickers list Vex and Atlas')
ok(text().includes('rules as written'), 'setup says the rules are as written')

// ---- a full match against the sparring partner, on Easy, with the odds shown ----
await click('Easy')
await setValue(byId('odds'), true, 'change')
await click('Start the match')
ok(text().includes('Your pick'), 'match starts with your pick')
ok(text().includes('Sparring partner · Easy'), 'the table shows the difficulty')
ok(/Neutral · reveal 1/.test(text()), 'phase bar shows the first neutral reveal')
ok(text().includes('Initiative +3'), 'someone holds the initiative')
ok(text().includes('Guard') && text().includes('Duck') && text().includes('Step'), 'the universal defences are in hand')
ok(/Clashes at \d+/.test(text()), 'attacks show their clash speed')
let sawCombo = false, sawCounter = false, sawMix = false
const played = await playOut(120, kind => {
  if (/Combo · beat/.test(text())) sawCombo = true
  if (kind === 'counter') sawCounter = true
  if (text().includes('The unexploitable mix')) sawMix = true
})
ok(played > 0, `played ${played} reveals`)
ok(sawMix, 'the mix is shown after a reveal')
await wait(300)
const over = /Game over/.test(text())
ok(over || played >= 120, 'the match ends or reaches the test limit')
if (over) ok(text().includes('Saved to the playtest log'), 'finished game is logged')
console.log(`  (match: ${played} reveals, combo seen ${sawCombo}, counter offered ${sawCounter}, over ${over})`)

// ---- the log ----
if (over) {
  await click('Playtest log')
  ok(text().includes('Vex vs Atlas') || text().includes('Atlas vs Vex'), 'the log lists the game')
  await click('Reveals')
  ok(/Both defend|Hit|Blocked|Exposed|Evaded|Thrown/.test(text()), 'the game\'s reveals show')
}

// ---- move lists: edit, save, reset ----
await click('Move lists')
ok(text().includes('Needle') && text().includes('Hilt Hook'), 'Vex\'s cards show')
ok(text().includes('Universal cards'), 'universal cards are listed')
const needle = find(app, n => n.localName === 'button' && n.attributes['aria-label'] === 'Edit Needle')
needle.dispatch('click'); await wait()
await setValue(byId('c-speed'), '7')
ok(text().includes('Unsaved changes'), 'an edit marks the fighter unsaved')
ok(text().includes('Speed 8 → 7'), 'the change is listed against the draft')
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
await setValue(ta, ta.value.replace('"direction": "throw"', '"direction": "throw", "linker": "light"'))
ok(text().includes("Throws can't be linkers or enders"), 'validation catches a throw linker')
ok(byText(app, 'button', 'Save').every(b => b.disabled), 'save is blocked while there are problems')
await click('Discard changes')

// ---- settings: an experiment ----
await click('Settings')
await setValue(byId('s-clock'), '30')
await click('Save settings')
await wait(200)
await click('Play')
if (button('New match')) await click('New match')
ok(text().includes('Experiments on: round timer of 30 reveals'), 'setup shows the experiment that is on')

// ---- a hot-seat match with the timer, played to the end ----
await click('Two players, one device')
await click('Start the match')
ok(text().includes("Player 1's pick"), 'hot seat starts with player 1')
ok(/Time 30/.test(text()), 'the round timer shows')
const hs = await playOut(200)
await wait(300)
ok(/Game over/.test(text()), `the timed hot-seat match ends (${hs} reveals)`)
ok(text().includes('Saved to the playtest log'), 'the hot-seat game is logged')

// ---- the grey-in-neutral and evade-cooldown experiments ----
await click('Settings')
await setValue(byId('s-gd'), 'card', 'change')
await setValue(byId('s-cash'), true, 'change')
await setValue(byId('s-evade'), true, 'change')
await click('Save settings')
await wait(200)
await click('Play')
if (button('New match')) await click('New match')
ok(text().includes('guard damage per card') && text().includes('throws cash the pile') && text().includes('Duck and Step cool down'), 'setup lists the new experiments')
await click('You vs sparring partner')
await click('Start the match')
ok(text().includes('Guard damage: '), 'card faces show their guard damage')
let sawEvadeCd = false
const gm = await playOut(40, () => { if (text().includes('Cooldown · back next reveal') && /Duck|Step/.test(text())) sawEvadeCd = true })
ok(gm > 0, `played ${gm} reveals with grey in neutral`)
await click('Leave this match')

// ---- the Lab, with the timer on so it runs quickly ----
await click('Lab')
await click('50')
await click('Run this matchup')
for (let i = 0; i < 300 && !text().includes('Linkers per combo'); i++) await wait(200)
ok(text().includes('Linkers per combo'), 'the Lab report appears')
ok(text().includes('Two defences') && text().includes('Damage by source'), 'the report shows the playtest targets')
ok(text().includes('experiments: round timer of 30 reveals'), 'the report records the experiment')
ok(text().includes('Read focus') && text().includes('Read shift'), 'the report shows read strength')

await click('Settings')
await click('Turn all off')
await click('Save settings')

console.log(`${checks - fails} / ${checks} checks passed${errors.length ? ` · ${errors.length} console errors` : ''}`)
if (errors.length) console.log(errors.slice(0, 5).join('\n'))
process.exit(fails || errors.length ? 1 : 0)
