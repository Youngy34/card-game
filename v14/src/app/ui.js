// Small shared pieces: the HUD, tokens, confirmations. (Carried over from the
// v13 app, with the HUD rebuilt for the wheel: no initiative, and the types a
// player is missing this reveal.)

import { html, cx, useState, useEffect } from './lib.js'
import { Mini } from './card.js'
import { bits, missingTypes } from '../engine/engine.js'
import { TYPE_LABEL } from '../engine/rules.js'

export function Tokens({ n, max = 60 }) {
  const fives = Math.floor(Math.min(n, max) / 5), ones = Math.min(n, max) - fives * 5
  return html`<span class="tokens" aria-label=${`${n} grey`}>
    ${Array.from({ length: fives }, (_, i) => html`<span class="tok5" key=${'f' + i}>5</span>`)}
    ${Array.from({ length: ones }, (_, i) => html`<span class="tok" key=${'o' + i}></span>`)}
    ${n > max ? html`<span class="small muted">+${n - max}</span>` : null}
  </span>`
}

export function LifeBar({ X }) {
  const base = X.f.hp, hp = Math.max(0, X.hp)
  const grey = Math.min(X.pile, hp)
  const w = v => `${(100 * v) / base}%`
  return html`<div class="lifebar">
    <div class="hp" role="img" aria-label=${`${hp} of ${base} HP, ${X.pile} grey`}>
      <div class="hp-fill" style=${{ width: w(hp) }}></div>
      <div class="hp-grey" style=${{ left: w(hp - grey), width: w(grey) }}></div>
    </div>
    <div class="hp-num">${X.hp}<small> / ${base} HP</small></div>
  </div>`
}

// One player's side of the table. side: 0 or 1; G: the game state.
export function Hud({ G, side, who }) {
  const X = side ? G.B : G.A
  const lethal = X.pile >= X.hp
  const miss = G.over ? [] : missingTypes(X)
  return html`<section class="hud" aria-label=${`${X.f.name}'s side`}>
    <div class="hud-head">
      <span class="hud-name">${X.f.name}</span>
      <span class="hud-who">${who}</span>
      <span class="hud-flags">
        ${miss.map(t => html`<span class="flag miss" data-d=${t} title=${`Every ${TYPE_LABEL[t]} card is cooling down`}>No ${TYPE_LABEL[t]}</span>`)}
        ${lethal ? html`<span class="flag lethal" title="Pile at least HP: any cash is a K.O.">Lethal pile</span>` : null}
      </span>
    </div>
    <${LifeBar} X=${X} />
    <div class="hud-row">
      <div class="pile"><span class="label">Grey</span><span class="pile-n">${X.pile}</span><${Tokens} n=${X.pile} /></div>
      ${G.R.focusMeter ? html`<div class="meter" aria-label=${`Meter ${X.meter || 0} of ${G.R.meterMax ?? 3}`}><span class="label">Meter</span>
        ${Array.from({ length: G.R.meterMax ?? 3 }, (_, i) => html`<span class=${cx('pip', i < (X.meter || 0) && 'on')} key=${i}></span>`)}</div>` : null}
    </div>
    <div class="cdtrack" aria-label="Cooldown track">
      ${[2, 1].map(s => {
        const ids = bits(s === 1 ? X.cd1 : X.cd2)
        return html`<div class="cdslot"><b>${s}</b><span class="minis">
          ${ids.map(i => html`<${Mini} c=${X.f.cards[i]} />`)}
          ${!ids.length ? html`<span class="empty">${s === 1 ? 'Back after next reveal' : 'Back in 2'} · empty</span>` : null}
        </span></div>`
      })}
    </div>
  </section>`
}

// An in-page confirmation (the viewer has no confirm() dialog)
export function Confirm({ text, yes = 'Yes', onYes, onNo, danger = true }) {
  return html`<div class="confirm" role="alertdialog">
    <p>${text}</p>
    <div class="actions">
      <button class=${cx('btn small', danger && 'danger')} onClick=${onYes}>${yes}</button>
      <button class="btn small ghost" onClick=${onNo}>Cancel</button>
    </div>
  </div>`
}

let toastSet = null
export function toast(msg) { toastSet?.(msg) }
export function Toaster() {
  const [msg, setMsg] = useState(null)
  useEffect(() => { toastSet = setMsg; return () => { toastSet = null } }, [])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t) }, [msg])
  return msg ? html`<div class="toast" role="status">${msg}</div>` : null
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); return true }
  catch { toast("Couldn't copy here. Select the text and copy it."); return false }
}

export function Seg({ value, options, onChange, label }) {
  return html`<div class="seg" role="group" aria-label=${label}>
    ${options.map(([v, l]) => html`<button type="button" aria-pressed=${value === v ? 'true' : 'false'} onClick=${() => onChange(v)}>${l}</button>`)}
  </div>`
}

export function StatusChip({ status }) {
  const label = { 'signed-off': 'Signed off', edited: 'Edited', variant: 'Variant', draft: 'Draft' }[status] || status
  return html`<span class=${cx('chip', status)}>${label}</span>`
}
