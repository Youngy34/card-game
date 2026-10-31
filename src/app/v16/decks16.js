// Decks (rules v16): view and edit each fighter's deck. Card faces with their
// copies, quick edits to copies and HP, and the full JSON for everything else.
// Edits save to the page's database; the bundled versions stay untouched.

import { html, cx, useState, useEffect, useMemo } from '../lib.js'
import { Card16 } from './card16.js'
import { Confirm, StatusChip, copyText, toast, Seg } from '../ui.js'
import { roster, saveFighter, removeFighter, getState, download } from '../store.js'
import { validateFighter16, deckSize, T16, LABEL16 } from '../../engine/v16/cards.js'
import { stableStringify } from '../../engine/fighters.js'

const clone = v => JSON.parse(JSON.stringify(v))
const same = (a, b) => stableStringify(a) === stableStringify(b)

export function Decks16({ selected, setSelected }) {
  const list = roster().filter(r => r.rules === 16)
  const entry = list.find(r => r.id === selected) || list[0]
  return html`<div class="ed">
    <nav class="ed-list" aria-label="Fighters">
      <span class="label">Fighters</span>
      ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${entry?.id === r.id ? 'true' : 'false'} onClick=${() => setSelected(r.id)}>
        <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
        <span class="meta">${r.fighter.hp} HP · ${deckSize(r.fighter)} cards${r.status === 'variant' && r.fighter.variantOf ? ` · from ${r.fighter.variantOf}` : ''}</span>
      </button>`)}
      <p class="small muted" style=${{ marginTop: '8px' }}>Edits apply to new matches and Lab runs. Every logged game keeps a copy of the exact deck it used.</p>
    </nav>
    ${entry ? html`<${DeckEditor} key=${entry.id} entry=${entry} list=${list} setSelected=${setSelected} />` : null}
  </div>`
}

function DeckEditor({ entry, list, setSelected }) {
  const [draft, setDraft] = useState(() => clone(entry.fighter))
  const [baseline, setBaseline] = useState(() => clone(entry.fighter))
  const [view, setView] = useState('cards')
  const [text, setText] = useState(() => JSON.stringify(entry.fighter, null, 2))
  const [parseErr, setParseErr] = useState(null)
  const [ask, setAsk] = useState(null)
  const [busy, setBusy] = useState(false)
  const st = getState()
  const readOnly = st.canEdit === false
  const dirtyDeck = !same(draft, baseline)

  useEffect(() => {
    if (same(draft, baseline) || same(draft, entry.fighter)) { setDraft(clone(entry.fighter)); setText(JSON.stringify(entry.fighter, null, 2)) }
    setBaseline(clone(entry.fighter))
  }, [entry.hash])

  const v = useMemo(() => validateFighter16(draft), [stableStringify(draft)])
  const dirty = dirtyDeck || !!parseErr
  const set = d => { setDraft(d); setText(JSON.stringify(d, null, 2)); setParseErr(null) }
  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast(ok) } catch (e) { toast(e.message || 'That didn\'t work.') }
    setBusy(false)
  }
  const onText = t => {
    setText(t)
    try { const f = JSON.parse(t); setDraft(f); setParseErr(null) } catch (e) { setParseErr(e.message) }
  }
  const copies = (k, d) => { const f = clone(draft); f.cards[k].copies = Math.max(1, Math.min(8, (f.cards[k].copies || 1) + d)); set(f) }
  const duplicate = () => {
    const ids = new Set(list.map(r => r.id))
    const root = draft.variantOf || draft.id
    let n = 2; while (ids.has(`${root}-v${n}`)) n++
    const f = { ...clone(draft), id: `${root}-v${n}`, name: `${draft.name} v${n}`, variantOf: root }
    run(async () => { await saveFighter(f); setSelected(f.id) }, `Made ${f.name}`)
  }
  const size = deckSize(draft)
  const mix = ['P', 'C', 'R', 'N'].map(t => [t, (draft.cards || []).reduce((s, c) => s + (T16[c.type] === t ? c.copies || 0 : 0), 0)])
  const counters = (draft.cards || []).reduce((s, c) => s + ((c.icons || []).includes('counter') ? c.copies || 0 : 0), 0)

  return html`<div class="stack" style=${{ gap: '20px' }}>
    <div class="spread">
      <div class="stack" style=${{ gap: '6px' }}>
        <div class="row"><h2>${draft.name || 'Unnamed'}</h2><${StatusChip} status=${entry.status} />${dirty ? html`<span class="changed-dot">Unsaved changes</span>` : null}</div>
        <span class="small muted">${draft.concept || ''}</span>
      </div>
      <${Seg} value=${view} onChange=${setView} label="View" options=${[['cards', 'Cards'], ['json', 'JSON']]} />
    </div>
    ${readOnly ? html`<div class="banner">Only editors of this page can save changes. You can still look, copy and download.</div>` : null}
    <div class="stats">
      <div class="stat-tile"><span class="label">HP</span>
        <div class="row" style=${{ gap: '6px' }}><button class="btn small ghost" disabled=${readOnly} onClick=${() => set({ ...draft, hp: Math.max(1, draft.hp - 1) })}>−</button><b>${draft.hp}</b><button class="btn small ghost" disabled=${readOnly} onClick=${() => set({ ...draft, hp: Math.min(99, draft.hp + 1) })}>+</button></div></div>
      <div class="stat-tile"><span class="label">Deck</span><b>${size}</b><span class="small muted">${mix.map(([t, n]) => `${n} ${LABEL16[t]}`).join(' · ')}</span></div>
      <div class="stat-tile"><span class="label">Counters</span><b>${counters}</b><span class="small muted">at least 6 in 24 recommended</span></div>
    </div>
    ${v.errors.length || v.warnings.length || parseErr ? html`<div class="msgs">
      ${parseErr ? html`<div class="msg-e">The JSON doesn't parse: ${parseErr}</div>` : null}
      ${v.errors.map(e => html`<div class="msg-e">${e.where}: ${e.msg}</div>`)}
      ${v.warnings.map(e => html`<div class="msg-w">${e.where}: ${e.msg}</div>`)}
    </div>` : null}
    ${view === 'cards' ? html`<div class="cards-grid">
      ${(draft.cards || []).map((c, k) => html`<div key=${k}>
        <${Card16} card=${c} copies=${c.copies} />
        <div class="row" style=${{ gap: '6px' }}><button class="btn small ghost" disabled=${readOnly || c.copies <= 1} onClick=${() => copies(k, -1)} aria-label=${`One fewer ${c.name}`}>−</button><span class="small num">${c.copies} ${c.copies === 1 ? 'copy' : 'copies'}</span><button class="btn small ghost" disabled=${readOnly || c.copies >= 8} onClick=${() => copies(k, 1)} aria-label=${`One more ${c.name}`}>+</button></div>
      </div>`)}
      ${draft.super ? html`<div><${Card16} card=${draft.super} isSuper=${true} /><span class="small muted">Super · beside the deck</span></div>` : null}
    </div>` : html`<label class="field"><span>Fighter JSON (rules v16)</span>
      <textarea rows="28" spellcheck="false" value=${text} onInput=${e => onText(e.target.value)} readOnly=${readOnly}></textarea>
    </label>
    <details class="panel details"><summary><h3>Card fields</h3></summary><div class="small stack" style=${{ marginTop: '10px', gap: '6px' }}>
      <p><b>type</b> pressure, convert, recover or neutral · <b>kind</b> strike or projectile (Pressure), guardBreak or grab (Convert), guard (Recover) · <b>speed</b> 11–19 for a Pressure (20 on a Super), 1–10 for a Convert · <b>build</b>, <b>chip</b> · <b>copies</b> 1–8.</p>
      <p><b>icons</b>: any of "starter", "linker", "ender", "counter". <b>onHit</b>: "knockdown", "staggered", "dizzy" (Supers only) or {"lock": "pressure" | "convert" | "recover"}. <b>cost</b>: the same, on yourself next round. <b>onLossSelf</b>: tokens on your own pile if it's beaten.</p>
      <p>Neutral cards: <b>thisRound</b> with any of convertChip, pressureBuild, attackChip, speed. The Super: <b>meter</b> (its cost, default 3), no copies.</p>
    </div></details>`}
    <div class="actions">
      <button class="btn" disabled=${!dirtyDeck || !!v.errors.length || !!parseErr || busy || readOnly} onClick=${() => run(() => saveFighter(draft), 'Saved')}>Save</button>
      ${dirty ? html`<button class="btn ghost" onClick=${() => set(clone(baseline))}>Discard changes</button>` : null}
      <button class="btn ghost small" disabled=${busy || readOnly || !!v.errors.length} onClick=${duplicate}>Duplicate as a variant</button>
      ${entry.base && entry.saved ? html`<button class="btn ghost small" disabled=${busy || readOnly} onClick=${() => setAsk('reset')}>Reset to bundled</button>` : null}
      ${!entry.base ? html`<button class="btn ghost small" disabled=${busy || readOnly} onClick=${() => setAsk('delete')}>Delete variant</button>` : null}
      <button class="link" onClick=${() => copyText(JSON.stringify(draft, null, 2))}>Copy JSON</button>
      <button class="link" onClick=${() => download(`${draft.id}.json`, JSON.stringify(draft, null, 2)).catch(e => toast(e.message))}>Download</button>
    </div>
    ${ask ? html`<${Confirm} text=${ask === 'reset' ? `Reset ${draft.name} to the bundled deck? Saved edits are lost.` : `Delete ${draft.name}?`} yes=${ask === 'reset' ? 'Reset' : 'Delete'}
      onYes=${() => { const id = entry.id; setAsk(null); run(async () => { await removeFighter(id); if (ask === 'delete') setSelected(null) }, ask === 'reset' ? 'Reset' : 'Deleted') }} onNo=${() => setAsk(null)} />` : null}
  </div>`
}
