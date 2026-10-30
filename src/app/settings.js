// Settings: rule variants and the sparring partner's weights.

import { html, useState, useEffect } from './lib.js'
import { settings, saveSettings, resetSettings, getState, roster } from './store.js'
import { DEFAULT_WEIGHTS } from '../engine/ai.js'
import { toast } from './ui.js'

const WEIGHTS = [
  ['alpha', 'A grey token is worth (HP)', 'Grey can be healed away, so a token counts for less than a point of HP.'],
  ['beta', 'Holding the Super is worth (HP)', ''],
  ['opt', 'Each card in hand is worth (HP)', 'Options: more available cards is better.'],
  ['gap', 'Each type it can\'t play next round costs (HP)', 'How much the partner fears a lockout or stagger.'],
  ['lethal', 'Being dead to a Convert costs (HP)', ''],
  ['flowv', 'Being in Flow next round is worth (HP)', 'Vex only.'],
  ['followv', 'Each point of follow-up chip is worth (HP per round)', 'Setup cards such as Taunt.'],
  ['boostv', 'Frame advantage next round is worth (HP)', 'Rules v15: a Recover with frame advantage. A guess; raise it if the partner undervalues Block.'],
  ['k', 'How sharply an HP lead turns into a win', 'Steepness of the win-chance curve.'],
]

export function Settings() {
  const cur = settings()
  const [d, setD] = useState(cur)
  const st = getState()
  const readOnly = st.canEdit === false
  useEffect(() => { setD(settings()) }, [st.settings])
  const changed = JSON.stringify(d) !== JSON.stringify(cur)
  const isDefault = !st.settings
  const save = () => saveSettings(d).then(() => toast('Saved'), e => toast(e.message))
  const rs = roster()
  const hasV11 = rs.some(r => r.rules === 11), hasV15 = rs.some(r => r.rules === 15)
  const rule = p => setD({ ...d, rules: { ...d.rules, ...p } })

  return html`<div class="stack" style=${{ gap: '24px', maxWidth: '760px' }}>
    <div class="stack"><h1>Settings</h1>
      <p class="lede">These apply to new matches and Lab runs. Every logged game records the settings it ran under.</p></div>
    ${readOnly ? html`<div class="banner">Only editors of this page can change settings.</div>` : null}
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <h3>Rules</h3>
      ${hasV15 ? html`
      <label class="field"><span>When a Recover beats a Pressure (rules v15)</span>
        <select id="s-payoff" value=${d.rules.recoverPayoff} onChange=${e => rule({ recoverPayoff: e.target.value })}>
          <option value="any">Its owner may follow up with any attack from hand (as written)</option>
          <option value="pressure">Its owner may follow up with a Pressure only (simmed, rejected)</option>
          <option value="fixed">The attacker takes fixed damage (simmed, partly works)</option>
          <option value="none">Nothing beyond clearing (simmed, rejected: mindless attacking wins)</option>
        </select>
      </label>
      ${d.rules.recoverPayoff === 'fixed' ? html`<label class="field" style=${{ maxWidth: '220px' }}><span>Fixed damage</span>
        <input id="s-fixed" type="number" min="1" max="10" value=${d.rules.fixedDamage} onInput=${e => rule({ fixedDamage: Math.max(1, Math.trunc(Number(e.target.value)) || 2) })} />
      </label>` : null}
      <label class="check"><input id="s-projsafe" type="checkbox" checked=${!!d.rules.projectileSafe} onChange=${e => rule({ projectileSafe: e.target.checked })} /> Experiment: a Projectile that's Recovered gives no payoff (thrown from range, it leaves nothing to punish)</label>` : null}
      ${hasV11 ? html`<label class="field"><span>When a Recover's chip lands (rules v11 fighters only; under v12, Recovers never chip)</span>
        <select id="s-counter" value=${d.rules.counterChip} onChange=${e => setD({ ...d, rules: { ...d.rules, counterChip: e.target.value } })}>
          <option value="always">Whenever it resolves (current rule)</option>
          <option value="attack">Only against an attack: a Pressure it beats, or a typeless card that chips (tested, not adopted)</option>
          <option value="strict">Only when it beats a Pressure (tested, not adopted)</option>
        </select>
      </label>` : null}
      <label class="field" style=${{ maxWidth: '220px' }}><span>Round limit (counts as a draw)</span>
        <input id="s-max" type="number" min="10" max="200" value=${d.rules.maxRounds} onInput=${e => setD({ ...d, rules: { ...d.rules, maxRounds: Math.max(10, Math.trunc(Number(e.target.value)) || 60) } })} />
      </label>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Sparring partner</h3><button class="link" type="button" onClick=${() => setD({ ...d, ai: { ...DEFAULT_WEIGHTS } })}>Use the simulator's defaults</button></div>
      <p class="small muted">The partner looks one round ahead and scores each board with these weights. Anything that pays off later is valued only through them. A fighter's own grey can be valued separately on its move list (the Gambler uses 0.3).</p>
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
