// The card face, generated from the card's data so it always matches the engine.
// A card with `art` (a full card-design image) shows that image instead.

import { html, cx } from './lib.js'
import { cardLines, TYPE_CODE, TYPE_LABEL, KINDS, kindLine } from '../engine/keywords.js'

// rules: the fighter's rules version (11, 12 or 15), for the line its kind prints
export function CardFace({ card, isSuper = false, hasFlow = false, cls = '', stamp = null, why = null, as = 'div', onClick, disabled, label, style, rules }) {
  if (!card) return null
  const t = TYPE_CODE[card.type] || 'T'
  const { text, cost } = cardLines(card, { isSuper })
  const build = card.build ?? 0, chip = card.chip ?? 0, cd = card.cooldown ?? 1
  const K = KINDS[card.kind]                                   // rules v12
  const typeName = K ? `${TYPE_LABEL[t]} · ${K.label}` : TYPE_LABEL[t]
  const hasSpeed = card.speed !== undefined && card.speed !== null
  const showChip = !(K && (t === 'R' || t === 'T') && !chip)   // v12 Recovers and Setups deal no damage
  const Tag = as
  const aria = label || `${card.name}, ${typeName}${isSuper ? ' Super' : ''}${hasSpeed ? `, speed ${card.speed}` : ''}`
  return html`
    <${Tag} class=${cx('card', isSuper && 'super', cls)} data-t=${t} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? aria : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      ${card.art ? html`<img class="card-art" src=${card.art} alt=${card.name} />` : html`
        <div class="card-band">
          <span>${isSuper ? `Super · ${typeName}` : typeName}</span>
          <span>${isSuper ? 'Once' : `CD ${cd}`}</span>
        </div>
        ${card.flowCard && hasFlow ? html`<span class="card-flow" title="Flow card">»</span>` : null}
        <div class="card-name">${card.name}</div>
        <div class="card-stats">
          ${hasSpeed ? html`<div class="stat speed"><b>${card.speed}</b><i>Speed</i></div>` : null}
          ${t === 'P' ? html`<div class="stat"><b>${build}</b><i>Build</i></div>` : null}
          ${showChip ? html`<div class="stat"><b>${chip}</b><i>Chip</i></div>` : null}
        </div>
        <div class="card-text">${(rules ? kindLine(card, rules) : K?.line) ? html`<p class="card-kind">${rules ? kindLine(card, rules) : K.line}</p>` : null}${text.map(l => html`<p>${l}</p>`)}</div>
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
