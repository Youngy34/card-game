// Card faces, generated from the card's data and the wheel, so they always
// match the engine. A card with `art` (a full card-design image) shows that
// image instead.

import { html, cx } from './lib.js'
import { cardText, TYPE_CODE, TYPE_LABEL } from '../engine/rules.js'

// A card from a fighter file (card format v4). `rules` decides the wheel the
// text describes.
export function CardFace({ card, rules, cls = '', stamp = null, why = null, note = null, as = 'div', onClick, disabled, label, style }) {
  if (!card) return null
  const t = TYPE_CODE[card.type] || 'S'
  const text = cardText(card, rules)
  const Tag = as
  const nums = t === 'S' ? `, Grey ${card.grey ?? 0}, Chip ${card.chip ?? 0}` : t === 'H' || t === 'G' ? `, Chip ${card.chip ?? 0}` : ''
  const aria = label || `${card.name}, ${TYPE_LABEL[t]}${nums}, cooldown ${card.cooldown ?? 1}`
  return html`
    <${Tag} class=${cx('card', cls)} data-d=${t} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? aria : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      ${card.art ? html`<img class="card-art" src=${card.art} alt=${card.name} />` : html`
        <div class="card-band">
          <span>${TYPE_LABEL[t]}</span>
          <span>CD ${card.cooldown ?? 1}</span>
        </div>
        <div class="card-name">${card.name}</div>
        ${t === 'S' || t === 'H' || t === 'G' ? html`<div class="card-stats">
          ${t === 'S' ? html`<div class="stat"><b>${card.grey ?? 0}</b><i>Grey</i></div>` : html`<div class="stat cash"><b>Cash</b></div>`}
          <div class="stat"><b>${card.chip ?? 0}</b><i>Chip</i></div>
        </div>` : null}
        <div class="card-text">
          ${text.map((l, i) => html`<p class=${i === 1 ? 'card-beats' : ''}>${l}</p>`)}
        </div>
      `}
      ${note ? html`<span class="card-note">${note}</span>` : null}
      ${stamp ? html`<span class="card-stamp">${stamp}</span>` : null}
      ${why ? html`<span class="card-why">${why}</span>` : null}
    <//>`
}

export function CardBack({ cls = '', label = 'Face down' }) {
  return html`<div class=${cx('card card-back', cls)} aria-label=${label}><span>YOMI</span></div>`
}

export function Mini({ c }) {
  return html`<span class="mini" data-d=${c.t}><span>${c.name}</span></span>`
}
