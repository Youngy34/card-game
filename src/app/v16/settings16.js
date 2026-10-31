// Settings (rules v16): the rule dials and the sparring partner's weights.

import { html, useState, useEffect, useRef } from '../lib.js'
import { saveSettings, resetSettings, getState } from '../store.js'
import { settings16 } from './fighters16.js'
import { DEFAULT_W16 } from '../../engine/v16/ai.js'
import { DEFAULT_RULES16 } from '../../engine/v16/engine.js'
import { toast } from '../ui.js'

const WEIGHTS = [
  ['alpha', 'A grey token on you costs (HP)', 'Grey can be cleared, so a token counts for less than a point of HP.'],
  ['card', 'Each card in hand is worth (HP)', 'Options, and what combos and follow-ups are made of.'],
  ['meter', 'Each point of meter is worth (HP)', ''],
  ['superReady', 'Meter for the Super is worth (HP, extra)', ''],
  ['knockdown', 'Being knocked down next round costs (HP)', ''],
  ['lock', 'Each type locked next round costs (HP)', ''],
  ['staggered', 'Being staggered next round costs (HP)', ''],
  ['dizzy', 'Being dizzy next round costs (HP)', 'A free hit for the opponent.'],
  ['k', 'How sharply an HP lead turns into a win', 'Steepness of the win-chance curve.'],
  ['samples', 'Hands it deals the opponent per clash', 'More is steadier and slower.'],
  ['neutralSamples', '… per neutral-phase choice', ''],
]
const int = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.trunc(Number(v)) || d))

export function Settings16() {
  const cur = settings16()
  const [d, setD] = useState(cur)
  const st = getState()
  const readOnly = st.canEdit === false
  const seen = useRef(st.settings)
  useEffect(() => { if (seen.current !== st.settings) { seen.current = st.settings; setD(settings16()) } }, [st.settings])
  const changed = JSON.stringify(d) !== JSON.stringify(cur)
  const rule = p => setD({ ...d, rules: { ...d.rules, ...p } })
  const num = (key, lo, hi, label, help) => html`<label class="field" title=${help || ''}><span>${label}</span>
    <input id=${'s-' + key} type="number" min=${lo} max=${hi} value=${d.rules[key]} onInput=${e => rule({ [key]: int(e.target.value, lo, hi, DEFAULT_RULES16[key]) })} />
    ${DEFAULT_RULES16[key] !== d.rules[key] ? html`<span class="small diff">As written: ${DEFAULT_RULES16[key]}</span>` : null}</label>`
  return html`<div class="stack" style=${{ gap: '24px', maxWidth: '760px' }}>
    <div class="stack"><h1>Settings</h1>
      <p class="lede">Rules v16's dials and the sparring partner's weights. They apply to new matches and Lab runs, and every logged game records the settings it ran under.</p></div>
    ${readOnly ? html`<div class="banner">Only editors of this page can change settings.</div>` : null}
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <h3>Rules</h3>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        ${num('openingHand', 3, 10, 'Opening hand')}
        ${num('handLimit', 4, 12, 'Hand limit')}
        ${num('meterMax', 1, 5, 'Meter maximum')}
        ${num('burnMax', 1, 5, 'Most cards burned a round', 'Open question: burning 3 at once makes the Super very frequent.')}
        ${num('maxRounds', 10, 200, 'Round limit (a draw)')}
      </div>
      <label class="field"><span>The Super</span>
        <select id="s-superuses" value=${String(d.rules.superUses)} onChange=${e => rule({ superUses: Number(e.target.value) })}>
          <option value="0">Reusable: meter is the only gate (as written)</option>
          <option value="1">Once per game</option>
        </select></label>
      <label class="field"><span>Speed ties: two attacks of the same type at the same speed</span>
        <select id="s-tie" value=${d.rules.speedTie} onChange=${e => rule({ speedTie: e.target.value })}>
          <option value="cancel">They cancel: neither lands</option>
          <option value="lowhp">The player on less HP wins the tie; on equal HP they cancel</option>
        </select></label>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Sparring partner</h3><button class="link" type="button" onClick=${() => setD({ ...d, ai: { ...DEFAULT_W16 } })}>Use the defaults</button></div>
      <p class="small muted">It deals you possible hands from the cards it hasn't seen, scores every pairing of clash cards a round ahead with these weights, and plays the mix that's safest across them. Anything that pays off later is valued only through the weights.</p>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        ${WEIGHTS.map(([k, label, help]) => html`<label class="field" title=${help}><span>${label}</span>
          <input id=${'s-' + k} type="number" step=${k === 'samples' || k === 'neutralSamples' ? 1 : 0.05} value=${d.ai[k]} onInput=${e => setD({ ...d, ai: { ...d.ai, [k]: Number(e.target.value) } })} />
          ${DEFAULT_W16[k] !== d.ai[k] ? html`<span class="small diff">Default ${DEFAULT_W16[k]}</span>` : null}
        </label>`)}
      </div>
    </fieldset>
    <div class="actions">
      <button class="btn" disabled=${!changed || readOnly} onClick=${() => saveSettings(d).then(() => toast('Saved'), e => toast(e.message))}>Save settings</button>
      ${changed ? html`<button class="btn ghost" onClick=${() => setD(cur)}>Discard</button>` : null}
      ${st.settings && !changed ? html`<button class="btn ghost small" disabled=${readOnly} onClick=${() => resetSettings().then(() => toast('Back to defaults'), e => toast(e.message))}>Back to defaults</button>` : null}
    </div>
  </div>`
}
