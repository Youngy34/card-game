// Small shared pieces: the HUD, tokens, confirmations. (Carried over from the
// v11/v12 app, with the HUD rebuilt for the initiative and combos.)

import { html, cx, useState, useEffect } from './lib.js'
import { Mini } from './card.js'
import { bits } from '../engine/engine.js'
import { UNIVERSAL, BREAK_IDS, BREAK_BIT, EVADE_BIT } from '../engine/rules.js'

export function Tokens({ n, max = 60 }) {
  const fives = Math.floor(Math.min(n, max) / 5), ones = Math.min(n, max) - fives * 5
  return html`<span class="tokens" aria-label=${`${n} grey`}>
    ${Array.from({ length: fives }, (_, i) => html`<span class="tok5" key=${'f' + i}>5</span>`)}
    ${Array.from({ length: ones }, (_, i) => html`<span class="tok" key=${'o' + i}></span>`)}
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
  const combo = G.mode === 'combo' ? G.combo : null
  const holds = G.init === side
  const role = combo ? (combo.att === side ? 'Attacking' : 'Defending') : holds ? 'Initiative' : 'Minus'
  const locked = BREAK_IDS.filter(id => X.brk & BREAK_BIT[id])
  const evades = ['D', 'S'].filter(id => X.dcd & EVADE_BIT[id])
  return html`<section class=${cx('hud', !combo && holds && 'holds')} aria-label=${`${X.f.name}'s side`}>
    <div class="hud-head">
      <span class="hud-name">${X.f.name}</span>
      <span class="hud-who">${who}</span>
      <span class="hud-flags">
        <span class=${cx('flag', role === 'Initiative' && 'init', role === 'Attacking' && 'att', role === 'Defending' && 'def')}
          title=${role === 'Initiative' ? `+${G.R.initiativeBonus} Speed in clashes, and wins ties` : role === 'Minus' ? 'The other player holds the initiative' : ''}>${role === 'Initiative' ? `Initiative +${G.R.initiativeBonus}` : role}</span>
      </span>
    </div>
    <${LifeBar} X=${X} />
    <div class="hud-row">
      <div class="pile"><span class="label">Grey</span><span class="pile-n">${X.pile}</span><${Tokens} n=${X.pile} /></div>
    </div>
    <div class="cdtrack" aria-label="Cooldown track">
      ${[2, 1].map(s => {
        const ids = bits(s === 1 ? X.cd1 : X.cd2)
        const brk = s === 1 ? locked : []
        return html`<div class="cdslot"><b>${s}</b><span class="minis">
          ${ids.map(i => html`<${Mini} c=${X.f.cards[i]} />`)}
          ${brk.map(id => html`<span class="mini" data-d="B"><span>${UNIVERSAL[id].name}</span></span>`)}
          ${s === 1 ? evades.map(id => html`<span class="mini" data-d="D"><span>${UNIVERSAL[id].name}</span></span>`) : null}
          ${!ids.length && !brk.length && !(s === 1 && evades.length) ? html`<span class="empty">${s === 1 ? 'Back after next reveal' : 'Back in 2'} · empty</span>` : null}
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
