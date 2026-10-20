// The card face, generated from the card's data so it always matches the engine.
// A card with `art` (a full card-design image) shows that image instead.

import { html, cx } from './lib.js'
import { cardLines, TYPE_CODE, TYPE_LABEL } from '../engine/keywords.js'

export function CardFace({ card, isSuper = false, hasFlow = false, cls = '', stamp = null, why = null, as = 'div', onClick, disabled, label, style }) {
  if (!card) return null
  const t = TYPE_CODE[card.type] || 'T'
  const { text, cost } = cardLines(card, { isSuper })
  const build = card.build ?? 0, chip = card.chip ?? 0, cd = card.cooldown ?? 1
  const Tag = as
  const aria = label || `${card.name}, ${TYPE_LABEL[t]}${isSuper ? ' Super' : ''}`
  return html`
    <${Tag} class=${cx('card', isSuper && 'super', cls)} data-t=${t} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? aria : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      ${card.art ? html`<img class="card-art" src=${card.art} alt=${card.name} />` : html`
        <div class="card-band">
          <span>${isSuper ? `Super · ${TYPE_LABEL[t]}` : TYPE_LABEL[t]}</span>
          <span>${isSuper ? 'Once' : `CD ${cd}`}</span>
        </div>
        ${card.flowCard && hasFlow ? html`<span class="card-flow" title="Flow card">»</span>` : null}
        <div class="card-name">${card.name}</div>
        <div class="card-stats">
          ${t === 'P' ? html`<div class="stat"><b>${build}</b><i>Build</i></div>` : null}
          <div class="stat"><b>${chip}</b><i>Chip</i></div>
        </div>
        <div class="card-text">${text.map(l => html`<p>${l}</p>`)}</div>
        ${isSuper && card.flavour && !cost.length ? html`<div class="card-flavour">${card.flavour}</div>` : null}
        ${cost.length ? html`<div class="card-cost"><b>Cost</b>${cost.map(l => html`<p>${l}</p>`)}</div>` : null}
      `}
      ${stamp ? html`<span class="card-stamp">${stamp}</span>` : null}
      ${why ? html`<span class="card-why">${why}</span>` : null}
    <//>`
}

export function CardBack({ cls = '', label = 'Face down' }) {
  return html`<div class=${cx('card card-back', cls)} aria-label=${label}><span>YOMI</span></div>`
}

export function Mini({ c, hasFlow }) {
  return html`<span class="mini" data-t=${c.t}><span>${c.name}</span>${c.kw?.flowCard && hasFlow ? html`<span class="flowmark" title="Flow card">»</span>` : null}</span>`
}
