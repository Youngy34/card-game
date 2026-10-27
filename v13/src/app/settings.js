// Settings: the rules dials, experimental rule switches, and the sparring
// partner's weights.

import { html, useState, useEffect } from './lib.js'
import { settings, saveSettings, resetSettings, getState } from './store.js'
import { DEFAULT_WEIGHTS } from '../engine/ai.js'
import { toast } from './ui.js'

const WEIGHTS = [
  ['alpha', 'A grey token on your pile costs (HP)', 'The next ender cashes it, or a break clears it.'],
  ['init', 'Holding the initiative is worth (HP)', ''],
  ['opt', 'Each attack card in hand is worth (HP)', 'Options: more available cards is better.'],
  ['gap', "Each direction you can't attack in costs (HP)", 'Horizontal, Vertical or Throw, all on cooldown.'],
  ['k', 'How sharply an HP lead turns into a win', 'Steepness of the win-chance curve.'],
]
const int = (v, lo, hi, d) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function Settings() {
  const cur = settings()
  const [d, setD] = useState(cur)
  const st = getState()
  const readOnly = st.canEdit === false
  useEffect(() => { setD(settings()) }, [st.settings])
  const changed = JSON.stringify(d) !== JSON.stringify(cur)
  const isDefault = !st.settings
  const save = () => saveSettings(d).then(() => toast('Saved'), e => toast(e.message))
  const R = (k, v) => setD({ ...d, rules: { ...d.rules, [k]: v } })

  return html`<div class="stack" style=${{ gap: '24px', maxWidth: '780px' }}>
    <div class="stack"><h1>Settings</h1>
      <p class="lede">These apply to new matches and Lab runs. Every logged game records the settings it ran under.</p></div>
    ${readOnly ? html`<div class="banner">Only editors of this page can change settings.</div>` : null}
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <h3>Rules</h3>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <label class="field"><span>Initiative bonus (Speed in clashes)</span>
          <input id="s-bonus" type="number" min="0" max="9" value=${d.rules.initiativeBonus} onInput=${e => R('initiativeBonus', int(e.target.value, 0, 9, 3))} /></label>
        <label class="field"><span>Combo cap (linkers and feints)</span>
          <input id="s-cap" type="number" min="1" max="9" value=${d.rules.comboCap} onInput=${e => R('comboCap', int(e.target.value, 1, 9, 3))} /></label>
        <label class="field"><span>First initiative</span>
          <select id="s-first" value=${d.rules.firstInitiative} onChange=${e => R('firstInitiative', e.target.value)}>
            <option value="random">At random</option><option value="a">Player 1 (you)</option><option value="b">Player 2</option>
          </select></label>
        <label class="field" title="Not a rule: a safety net so a game that stalls still ends."><span>Reveal limit (a draw)</span>
          <input id="s-max" type="number" min="20" max="400" value=${d.rules.maxReveals} onInput=${e => R('maxReveals', int(e.target.value, 20, 400, 100))} /></label>
      </div>
      <p class="small muted">Rules v13 as written: +3 initiative, a cap of 3, random first initiative. The reveal limit isn't a rule; it stops a stalled game.</p>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Experiments</h3><button class="link" type="button" onClick=${() => setD({ ...d, rules: { ...d.rules, clock: 0, counterCheck: 'after', blockGrey: 0, waitPasses: false, wrongBreakLocks: false } })}>Turn all off</button></div>
      <p class="small muted">Not in the rules. Off by default; each is a candidate fix for waiting in neutral or short combos, to test in the Lab and at the table.</p>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        <label class="field"><span>Round timer, in reveals (0 = off)</span>
          <input id="s-clock" type="number" min="0" max="200" value=${d.rules.clock} onInput=${e => R('clock', int(e.target.value, 0, 200, 0))} />
          <span class="small muted">When it runs out, at the end of a neutral reveal or a combo, more HP wins.</span></label>
        <label class="field"><span>Grey a blocked strike puts on the blocker</span>
          <input id="s-bgrey" type="number" min="0" max="5" value=${d.rules.blockGrey} onInput=${e => R('blockGrey', int(e.target.value, 0, 5, 0))} />
          <span class="small muted">Guard damage: guarding isn't free.</span></label>
        <label class="field"><span>Countering an exposed attack</span>
          <select id="s-counter" value=${d.rules.counterCheck} onChange=${e => R('counterCheck', e.target.value)}>
            <option value="after">The defender counts their new +${d.rules.initiativeBonus} (as written)</option>
            <option value="reveal">Initiative as it stood at the reveal</option>
          </select>
          <span class="small muted">The second makes the holder's attacks hard to counter, and the minus player's easy.</span></label>
      </div>
      <label class="check"><input id="s-wait" type="checkbox" checked=${d.rules.waitPasses} onChange=${e => R('waitPasses', e.target.checked)} /> Two defences pass the initiative to the other player</label>
      <label class="check"><input id="s-wrong" type="checkbox" checked=${d.rules.wrongBreakLocks} onChange=${e => R('wrongBreakLocks', e.target.checked)} /> A Break of the wrong strength is locked for the next beat, like a feinted one</label>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Sparring partner</h3><button class="link" type="button" onClick=${() => setD({ ...d, ai: { ...DEFAULT_WEIGHTS } })}>Use the defaults</button></div>
      <p class="small muted">The partner looks one neutral reveal ahead, plays out any counter and combo that reveal starts, and scores the board it reaches with these weights. With the round timer on, a lead counts for more as time runs out.</p>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        ${WEIGHTS.map(([k, label, help]) => html`<label class="field" title=${help}><span>${label}</span>
          <input id=${'s-' + k} type="number" step="0.05" value=${d.ai[k]} onInput=${e => setD({ ...d, ai: { ...d.ai, [k]: Number(e.target.value) } })} />
          ${DEFAULT_WEIGHTS[k] !== d.ai[k] ? html`<span class="small diff">Default ${DEFAULT_WEIGHTS[k]}</span>` : null}
        </label>`)}
      </div>
    </fieldset>
    <div class="actions">
      <button class="btn" disabled=${!changed || readOnly} onClick=${save}>Save settings</button>
      ${changed ? html`<button class="btn ghost" onClick=${() => setD(cur)}>Discard</button>` : null}
      ${!isDefault && !changed ? html`<button class="btn ghost small" disabled=${readOnly} onClick=${() => resetSettings().then(() => toast('Back to defaults'), e => toast(e.message))}>Back to defaults</button>` : null}
    </div>
  </div>`
}
