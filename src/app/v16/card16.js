// The v16 card face, written from the card's data so it always matches the engine.

import { html, cx } from '../lib.js'
import { T16, LABEL16, KINDS16, ICONS, ICON_ORDER, cardLines16 } from '../../engine/v16/cards.js'

// card: the card's JSON (an engine card's .src)
export function Card16({ card, isSuper = false, copies = null, cls = '', stamp = null, why = null, as = 'div', onClick, disabled, label, style, count = null }) {
  if (!card) return null
  const t = T16[card.type] || 'N'
  const { text, cost } = cardLines16(card, { isSuper })
  const K = KINDS16[card.kind]
  const typeName = K ? `${LABEL16[t]} · ${K.label}` : LABEL16[t]
  const icons = ICON_ORDER.filter(i => (card.icons || []).includes(i))
  const Tag = as
  const aria = label || `${card.name}, ${typeName}${isSuper ? ' Super' : ''}${card.speed ? `, speed ${card.speed}` : ''}${icons.length ? `, ${icons.map(i => ICONS[i].label).join(', ')}` : ''}`
  return html`
    <${Tag} class=${cx('card', 'c16', isSuper && 'super', cls)} data-t=${t === 'N' ? 'T' : t} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? aria : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      ${card.art ? html`<img class="card-art" src=${card.art} alt=${card.name} />` : html`
        <div class="card-band">
          <span>${isSuper ? `Super · ${typeName}` : typeName}</span>
          <span>${isSuper ? `${card.meter ?? 3} meter` : copies ? `×${copies}` : ''}</span>
        </div>
        <div class="card-name">${card.name}</div>
        <div class="card-stats">
          ${card.speed ? html`<div class="stat speed"><b>${card.speed}</b><i>Speed</i></div>` : null}
          ${t === 'P' ? html`<div class="stat"><b>${card.build ?? 0}</b><i>Build</i></div>` : null}
          ${t === 'P' || t === 'C' || card.chip ? html`<div class="stat"><b>${card.chip ?? 0}</b><i>Chip</i></div>` : null}
        </div>
        ${icons.length ? html`<div class="icons">${icons.map(i => html`<span class=${cx('icon', i)} title=${ICONS[i].line}>${ICONS[i].label}</span>`)}</div>` : null}
        <div class="card-text">${text.map(l => html`<p>${l}</p>`)}</div>
        ${isSuper && card.flavour && !cost.length ? html`<div class="card-flavour">${card.flavour}</div>` : null}
        ${cost.length ? html`<div class="card-cost"><b>Cost</b>${cost.map(l => html`<p>${l}</p>`)}</div>` : null}
      `}
      ${count !== null ? html`<span class="card-count">×${count}</span>` : null}
      ${stamp ? html`<span class="card-stamp">${stamp}</span>` : null}
      ${why ? html`<span class="card-why">${why}</span>` : null}
    <//>`
}

export function Back16({ label = 'Face down', small = false }) {
  return html`<div class=${cx('card card-back', small && 'small')} aria-label=${label}><span>YOMI</span></div>`
}

// A one-line chip for a card, for logs and lists
export function Chip16({ c, note }) {
  const t = c.t === 'N' ? 'T' : c.t
  return html`<span class="mini" data-t=${t}><span>${c.name}</span>${note ? html`<span class="muted">${note}</span>` : null}</span>`
}
