// Small shared pieces: the HUD parts, tokens, confirmations.

import { html, cx, useState, useEffect } from './lib.js'
import { Mini } from './card.js'
import { TYPE_LABEL } from '../engine/keywords.js'
import { typesOpen, lethalTo, flowing } from './match.js'
import { getState } from './store.js'

export function Tokens({ n, max = 60 }) {
  const fives = Math.floor(Math.min(n, max) / 5), ones = Math.min(n, max) - fives * 5
  return html`<span class="tokens" aria-label=${`${n} grey tokens`}>
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

export function Hud({ X, Y, who, staggered }) {
  const lethal = lethalTo(X, Y)
  const fl = X.f.flow && flowing(X)
  return html`<section class="hud" aria-label=${`${X.f.name}'s side`}>
    <div class="hud-head">
      <span class="hud-name">${X.f.name}</span>
      <span class="hud-who">${who}</span>
      <span class="hud-flags">
        ${fl ? html`<span class="flag flow">Flowing</span>` : null}
        ${lethal !== null ? html`<span class="flag lethal" title=${`Pile ${X.pile} + a Convert chipping ${lethal} ≥ ${X.hp} HP`}>Dead to a Convert</span>` : null}
        ${X.f.sup ? html`<span class=${cx('flag sup', !X.sup && 'spent')} title=${X.f.sup.name}>Super${X.sup ? ' ready' : ' used'}</span>` : null}
      </span>
    </div>
    <${LifeBar} X=${X} />
    <div class="hud-row">
      <div class="pile"><span class="label">Grey</span><span class="pile-n">${X.pile}</span><${Tokens} n=${X.pile} /></div>
      <div class="typepips" aria-label="Types they can play this round">
        ${typesOpen(X).filter(p => p.has).map(p => html`<span class=${cx('pip', !p.open && 'shut')} data-t=${p.t} title=${p.open ? `Can play a ${TYPE_LABEL[p.t]}` : `Can't play a ${TYPE_LABEL[p.t]} this round`}>${TYPE_LABEL[p.t].slice(0, 1)}</span>`)}
      </div>
    </div>
    <div class="cdtrack" aria-label="Cooldown track">
      ${[2, 1].map(s => {
        const ids = s === 1 ? X.cd1 : X.cd2
        return html`<div class="cdslot"><b>${s}</b><span class="minis">
          ${ids.length ? ids.map(i => html`<${Mini} c=${X.f.cards[i]} hasFlow=${X.f.flow} />`) : html`<span class="empty">${s === 1 ? 'Back next round' : 'Back in 2'} · empty</span>`}
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
  const custom = getState().edition?.labels?.[status]
  const label = custom || { 'signed-off': 'Signed off', edited: 'Edited', variant: 'Variant', reference: 'Reference', draft: 'Draft' }[status] || status
  return html`<span class=${cx('chip', status)}>${label}</span>`
}
