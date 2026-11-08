// Settings (rules v16): the rule dials and the sparring partner's weights.

import { html, useState, useEffect, useRef } from '../lib.js'
import { saveSettings, resetSettings, getState } from '../store.js'
import { settings16 } from './fighters16.js'
import { DEFAULT_W16 } from '../../engine/v16/ai.js'
import { DEFAULT_RULES16 } from '../../engine/v16/engine.js'
import { toast, NumField } from '../ui.js'

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
  ['mySamples', 'Hands it deals itself, as you might guess them (1 = off)', 'Rules v18: it plays as if you can\'t see its hand either, solving over its real hand and these guesses at it. 4 as tuned on 3 November.'],
]
const V18_ONLY = new Set(['mySamples']), PRE_V18 = new Set(['neutralSamples'])

export function Settings16() {
  const cur = settings16()
  const [d, setD] = useState(cur)
  const st = getState()
  const readOnly = st.canEdit === false
  const seen = useRef(st.settings)
  useEffect(() => { if (seen.current !== st.settings) { seen.current = st.settings; setD(settings16()) } }, [st.settings])
  const changed = JSON.stringify(d) !== JSON.stringify(cur)
  // The page's own defaults (its settings file), not the engine's v16 ones
  const base = { rules: { ...DEFAULT_RULES16, ...(st.defaults?.rules || {}) }, ai: { ...DEFAULT_W16, ...(st.defaults?.ai || {}) } }
  const v18 = !!d.rules.merged
  const rule = p => setD({ ...d, rules: { ...d.rules, ...p } })
  const num = (key, lo, hi, label, help) => html`<label class="field" title=${help || ''}><span>${label}</span>
    <${NumField} id=${'s-' + key} lo=${lo} hi=${hi} value=${d.rules[key]} onValue=${v => rule({ [key]: v })} />
    <span class="small muted">${lo}–${hi}${base.rules[key] !== d.rules[key] ? html` · <span class="diff">As written: ${base.rules[key]}</span>` : ''}</span></label>`
  return html`<div class="stack" style=${{ gap: '24px', maxWidth: '760px' }}>
    <div class="stack"><h1>Settings</h1>
      <p class="lede">Rules v${v18 ? 18 : d.rules.tableCards ? 17 : 16}'s dials and the sparring partner's weights. They apply to new matches and Lab runs, and every logged game records the settings it ran under.</p></div>
    ${readOnly ? html`<div class="banner">Only editors of this page can change settings.</div>` : null}
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <h3>Rules</h3>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        ${num('openingHand', 3, 10, 'Opening hand')}
        ${num('handLimit', 4, 12, 'Clash hand limit')}
        ${v18 ? null : num('neutralHand', 1, 5, 'Neutral hand (refilled each round)')}
        ${num('greyPerRound', 0, 3, 'Grey taken each round', 'In the draw step each player adds this much grey to their own pile, so Converts and Guards always have grey to work on. 1 since 1 November; 0 is the old game.')}
        ${v18 ? num('greyCap', 0, 30, 'Grey cap (0 = off)', 'v19 test: 9 on the v19 page, 0 is v18. A fighter may print its own cap, used whenever this is on. With Overflow, a pile can\'t go above its cap and grey beyond it is lost as HP at once; without it, a pile that has reached the cap at the end of the round is cashed for its size.') : null}
        ${num('confiscateFloor', 0, 5, 'Confiscate floor', 'Confiscate (the Warden) never takes a player below this many clash cards. 2 as written.')}
        ${num('meterMax', 1, 5, 'Meter track maximum', 'Each Super prints its own cost; the Benchmark\'s Overdrive costs 3.')}
        ${v18 ? null : num('burnMax', 0, 5, 'Burning: most cards a round (0 = off)', 'The first draft burned cards for meter. Off since 31 October: Focus gains meter instead.')}
        ${num('maxRounds', 10, 200, 'Round limit (a draw)')}
      </div>
      ${d.rules.tableCards ? null : html`<label class="field"><span>The Super</span>
        <select id="s-superuses" value=${String(d.rules.superUses)} onChange=${e => rule({ superUses: Number(e.target.value) })}>
          <option value="0">Reusable: meter is the only gate (as written)</option>
          <option value="1">Once per game</option>
        </select></label>`}
      ${v18 && d.rules.greyCap ? html`<label class="field"><span>At the cap</span>
        <select id="s-overflow" value=${d.rules.greyOverflow ? 'overflow' : 'cash'} onChange=${e => rule({ greyOverflow: e.target.value === 'overflow' })}>
          <option value="overflow">Overflow: the pile stops at the cap, and grey beyond it is lost as HP at once (v19)</option>
          <option value="cash">Cash: a pile that has reached the cap at the end of the round is cashed for its size (the first v19 test)</option>
        </select></label>` : null}
      ${v18 ? html`<label class="field"><span>When a Convert cashes</span>
        <select id="s-cashonwin" value=${d.rules.cashOnWin ? 'win' : 'any'} onChange=${e => rule({ cashOnWin: e.target.value === 'win' })}>
          <option value="win">Only as the clash card: a Convert played as a Linker, Ender or follow-up just deals its damage (v19)</option>
          <option value="any">Whenever it hits, combos and follow-ups included (v18)</option>
        </select></label>` : null}
      ${v18 ? html`<label class="field"><span>Combo lines</span>
        <select id="s-combolines" value=${d.rules.comboSameType ? 'same' : 'any'} onChange=${e => rule({ comboSameType: e.target.value === 'same' })}>
          <option value="same">Two lines: a combo continues only with cards of its Starter's type (v19)</option>
          <option value="any">One line: any Linker or Ender (v18)</option>
        </select></label>` : null}
      <label class="field"><span>Speed ties: two attacks of the same type at the same speed</span>
        <select id="s-tie" value=${d.rules.speedTie} onChange=${e => rule({ speedTie: e.target.value })}>
          <option value="cancel">They cancel: neither lands</option>
          <option value="lowhp">The player on less HP wins the tie; on equal HP they cancel</option>
          ${d.rules.initiative ? html`<option value="initiative">The initiative holder wins the tie (v17)</option>` : null}
        </select></label>
    </fieldset>
    <fieldset class="panel stack" disabled=${readOnly} style=${{ margin: 0 }}>
      <div class="spread"><h3>Sparring partner</h3><button class="link" type="button" onClick=${() => setD({ ...d, ai: { ...base.ai } })}>Use the defaults</button></div>
      <p class="small muted">It deals you possible hands from the cards it hasn't seen, scores every pairing of clash cards a round ahead with these weights, and plays the mix that's safest across them. Anything that pays off later is valued only through the weights.</p>
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        ${WEIGHTS.filter(([k]) => (v18 ? !PRE_V18.has(k) : !V18_ONLY.has(k))).map(([k, label, help]) => html`<label class="field" title=${help}><span>${label}</span>
          <${NumField} id=${'s-' + k} int=${k === 'samples' || k === 'neutralSamples' || k === 'mySamples'} lo=${k === 'samples' || k === 'neutralSamples' || k === 'mySamples' ? 1 : 0} hi=${k === 'samples' || k === 'neutralSamples' || k === 'mySamples' ? 50 : undefined} value=${d.ai[k]} onValue=${v => setD({ ...d, ai: { ...d.ai, [k]: v } })} />
          ${base.ai[k] !== d.ai[k] ? html`<span class="small diff">Default ${base.ai[k]}</span>` : null}
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
