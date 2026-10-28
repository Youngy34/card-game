// Settings: the rules dials, experimental rule switches, and the sparring
// partner's weights.

import { html, useState, useEffect } from './lib.js'
import { settings, saveSettings, resetSettings, getState } from './store.js'
import { DEFAULT_WEIGHTS } from '../engine/ai.js'
import { WHEELS } from '../engine/rules.js'
import { toast } from './ui.js'

const WEIGHTS = [
  ['alpha', 'A grey token on your pile costs (HP)', 'A cash turns it into damage, or a Focus clears it.'],
  ['meter', 'A pip of meter is worth (HP)', 'Only matters when Focus gains meter. There are no meter cards yet, so this is what tells the partner to want it.'],
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
        <label class="field" title="Not a rule: a safety net so a game that stalls still ends."><span>Reveal limit (a draw)</span>
          <input id="s-max" type="number" min="20" max="400" value=${d.rules.maxReveals} onInput=${e => R('maxReveals', int(e.target.value, 20, 400, 100))} /></label>
      </div>
      <p class="small muted">Rules v14 as written have no dials: the wheel decides every reveal. The reveal limit isn't a rule; it stops a stalled game.</p>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Experiments</h3><button class="link" type="button" onClick=${() => setD({ ...d, rules: { ...d.rules, wheel: 'v14', mirrors: 'none', blockedHeavyGrey: 0, focusMeter: 0 } })}>Turn all off</button></div>
      <p class="small muted">Not in the rules. Off by default; each is an open question from rules-overview 14.md, to test at the table and in the Lab.</p>
      <label class="field"><span>The wheel</span>
        <select id="s-wheel" value=${d.rules.wheel} onChange=${e => R('wheel', e.target.value)}>
          ${Object.entries(WHEELS).map(([k, w]) => html`<option value=${k}>${w.label}</option>`)}
        </select>
        <span class="small muted">The two alternatives from the 28 October discussion. Card faces, hints and the quick reference follow whichever is on.</span></label>
      <label class="field"><span>Mirrors (two cards of the same type)</span>
        <select id="s-mirrors" value=${d.rules.mirrors} onChange=${e => R('mirrors', e.target.value)}>
          <option value="none">Cancel: neither takes effect (as written)</option>
          <option value="all">Both take effect (two Grabs both land; a double KO is possible)</option>
          <option value="nograb">Strike, Heavy and Focus mirrors take effect; two Grabs tech</option>
          <option value="focus">Only two Focuses take effect (both clear)</option>
        </select>
        <span class="small muted">Focus is the mirror the rule strains on: it beats Block because nobody's hitting you, so two Focuses arguably both recover.</span></label>
      <label class="field"><span>Grey a blocked Heavy puts on its owner</span>
        <input id="s-bheavy" type="number" min="0" max="5" value=${d.rules.blockedHeavyGrey} onInput=${e => R('blockedHeavyGrey', int(e.target.value, 0, 5, 0))} />
        <span class="small muted">As written, 0: a Heavy prints no Grey, so a Block simply stops it. Above 0 makes every Heavy unsafe on block, the rider idea applied to everyone.</span></label>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <label class="field"><span>Meter a Focus gains when it takes effect (0 = off)</span>
          <input id="s-fmeter" type="number" min="0" max="3" value=${d.rules.focusMeter ?? 0} onInput=${e => R('focusMeter', int(e.target.value, 0, 3, 0))} /></label>
        <label class="field"><span>Most meter a player can hold</span>
          <input id="s-mmax" type="number" min="1" max="9" value=${d.rules.meterMax ?? 3} onInput=${e => R('meterMax', int(e.target.value, 1, 9, 3))} /></label>
      </div>
      <p class="small muted">The first step towards a meter layer: Focus builds meter, shown on each side of the table. There are no meter cards yet, so meter is never spent; the sparring partner values each pip at the weight below, which is what makes it want meter.</p>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Sparring partner</h3><button class="link" type="button" onClick=${() => setD({ ...d, ai: { ...DEFAULT_WEIGHTS } })}>Use the defaults</button></div>
      <p class="small muted">Each reveal the partner plays out every pairing of both players' cards, looks ahead the number of reveals below, scores the board it reaches with these weights, and plays the mix you can't exploit.</p>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <label class="field" title="1 is the throwaway bot of the 28 October rough check. 3 is slow in the Lab."><span>Reveals looked ahead (1–3)</span>
          <input id="s-depth" type="number" min="1" max="3" value=${d.ai.depth} onInput=${e => setD({ ...d, ai: { ...d.ai, depth: int(e.target.value, 1, 3, 2) } })} />
          ${DEFAULT_WEIGHTS.depth !== d.ai.depth ? html`<span class="small diff">Default ${DEFAULT_WEIGHTS.depth}</span>` : null}
        </label>
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
