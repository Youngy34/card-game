// Card faces, generated from the card's data so they always match the engine.
// A card with `art` (a full card-design image) shows that image instead.

import { html, cx } from './lib.js'
import { cardText, DIR_CODE, DIR_LABEL, ON_BLOCK, OB_TEXT, STR_CODE, STR_LABEL } from '../engine/rules.js'

// An attack card from a fighter file (card format v3)
export function CardFace({ card, cls = '', stamp = null, why = null, note = null, guard = false, as = 'div', onClick, disabled, label, style }) {
  if (!card) return null
  const d = DIR_CODE[card.direction] || 'H'
  const isThrow = d === 'T'
  const ob = ON_BLOCK[card.onBlock]
  const text = cardText(card, { guard })
  const role = card.linker ? `${STR_LABEL[STR_CODE[card.linker]] || ''} linker` : card.ender ? 'Ender' : null
  const Tag = as
  const aria = label || `${card.name}, ${DIR_LABEL[d]}, Speed ${card.speed}, Hit ${card.hit}${isThrow ? '' : `, ${card.onBlock} on block`}${role ? `, ${role}` : ''}`
  return html`
    <${Tag} class=${cx('card', cls)} data-d=${d} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? aria : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      ${card.art ? html`<img class="card-art" src=${card.art} alt=${card.name} />` : html`
        <div class="card-band">
          <span>${DIR_LABEL[d]}</span>
          <span>CD ${card.cooldown ?? 1}</span>
        </div>
        <div class="card-name">${card.name}</div>
        <div class="card-stats">
          <div class="stat speed"><b>${card.speed}</b><i>Spd</i></div>
          <div class="stat"><b>${card.hit}</b><i>Hit</i></div>
          ${isThrow ? (card.grey ? html`<div class="stat"><b>${card.grey}</b><i>Grey</i></div>` : null)
            : html`<div class=${cx('stat ob', ob > 0 && 'plus', ob < 0 && 'minus')}><b>${OB_TEXT[ob] ?? '?'}</b><i>Block</i></div>`}
        </div>
        <div class="card-text">
          ${text.map((l, i) => html`<p class=${i === 0 && role ? 'card-role' : ''}>${l}</p>`)}
        </div>
      `}
      ${note ? html`<span class="card-note">${note}</span>` : null}
      ${stamp ? html`<span class="card-stamp">${stamp}</span>` : null}
      ${why ? html`<span class="card-why">${why}</span>` : null}
    <//>`
}

// A universal card: Guard, Duck, Step or a Break. `role` 'feint' or 'hold' shows
// Guard's combo use.
export function UniversalFace({ card, role = null, cls = '', stamp = null, why = null, as = 'div', onClick, disabled, style }) {
  const isBreak = card.group === 'break'
  const Tag = as
  const name = role === 'feint' ? 'Feint' : role === 'hold' ? 'Hold' : card.name
  const band = isBreak ? 'Combo · break' : role ? 'Combo · Guard' : 'Defence'
  const text = role === 'feint' ? 'Draws out a Break: it is locked for the next beat. Against a hold, the combo drops.'
    : role === 'hold' ? 'Lets the linker land. Against a feint, the combo drops and you take the initiative.'
    : isBreak ? card.combo : card.neutral
  return html`
    <${Tag} class=${cx('card', 'universal', cls)} data-d=${isBreak ? 'B' : 'D'} onClick=${onClick} disabled=${disabled}
      aria-label=${as === 'button' ? `${name}${role ? ' (Guard)' : ''}` : undefined} type=${as === 'button' ? 'button' : undefined} style=${style}>
      <div class="card-band"><span>${band}</span><span>${isBreak || role ? '' : 'No CD'}</span></div>
      <div class="card-name">${name}</div>
      ${isBreak ? html`<div class="card-stats"><div class="stat"><b>${card.str}</b><i>${STR_LABEL[card.str]}</i></div></div>` : null}
      <div class="card-text"><p>${text}</p></div>
      ${stamp ? html`<span class="card-stamp">${stamp}</span>` : null}
      ${why ? html`<span class="card-why">${why}</span>` : null}
    <//>`
}

// Either kind, from a hand-view entry
export function AnyFace({ v, guard, ...rest }) {
  return v.attack ? html`<${CardFace} card=${v.card} guard=${guard} ...${rest} />` : html`<${UniversalFace} card=${v.card} role=${v.role} ...${rest} />`
}

export function CardBack({ cls = '', label = 'Face down' }) {
  return html`<div class=${cx('card card-back', cls)} aria-label=${label}><span>YOMI</span></div>`
}

export function Mini({ c }) {
  return html`<span class="mini" data-d=${c.dir}><span>${c.name}</span></span>`
}
