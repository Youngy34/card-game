// Move lists: view and edit every fighter's cards, as a form or as raw JSON.
// Edits save to the artifact's database; the bundled drafts stay untouched, so
// any fighter can be reset. (Carried over from the v13 app, with the card form
// rebuilt for card format v4.)

import { html, cx, useState, useEffect, useMemo } from './lib.js'
import { CardFace } from './card.js'
import { Confirm, StatusChip, copyText, toast, Seg } from './ui.js'
import { roster, saveFighter, removeFighter, getState, download, settings } from './store.js'
import { validateFighter, validateCard, stableStringify, MAX_CARDS } from '../engine/fighters.js'
import { TYPES, TYPE_CODE, TYPE_LABEL, CODES, winText } from '../engine/rules.js'
import { Wheel } from './play.js'

const clone = v => JSON.parse(JSON.stringify(v))
const same = (a, b) => stableStringify(a) === stableStringify(b)

export function Editor({ selected, setSelected }) {
  const list = roster()
  const entry = list.find(r => r.id === selected) || list[0]
  return html`<div class="ed">
    <nav class="ed-list" aria-label="Fighters">
      <span class="label">Fighters</span>
      ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${entry?.id === r.id ? 'true' : 'false'} onClick=${() => setSelected(r.id)}>
        <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
        <span class="meta">${r.fighter.hp} HP${r.status === 'variant' && r.fighter.variantOf ? ` · from ${r.fighter.variantOf}` : ''}</span>
      </button>`)}
      <p class="small muted" style=${{ marginTop: '8px' }}>Edits apply to new matches and Lab runs. Every logged game keeps a copy of the exact version it used.</p>
    </nav>
    ${entry ? html`<${FighterEditor} key=${entry.id} entry=${entry} list=${list} setSelected=${setSelected} />` : null}
  </div>`
}

function FighterEditor({ entry, list, setSelected }) {
  const [draft, setDraft] = useState(() => clone(entry.fighter))
  const [baseline, setBaseline] = useState(() => clone(entry.fighter))
  const [view, setView] = useState('cards')
  const [editing, setEditing] = useState(null)
  const [ask, setAsk] = useState(null)
  const [busy, setBusy] = useState(false)
  const st = getState()
  const readOnly = st.canEdit === false
  const offline = st.backend === 'connecting'
  const dirty = !same(draft, baseline)

  useEffect(() => {
    if (same(draft, baseline) || same(draft, entry.fighter)) setDraft(clone(entry.fighter))
    setBaseline(clone(entry.fighter))
  }, [entry.hash])

  const v = useMemo(() => validateFighter(draft), [stableStringify(draft)])
  const rules = settings().rules
  const base = entry.base
  const changes = base ? diffFighter(base, draft) : []

  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast(ok) } catch (e) { toast(e.message || "That didn't work.") }
    setBusy(false)
  }
  const save = () => run(() => saveFighter(draft), 'Saved')
  const duplicate = () => {
    const ids = new Set(list.map(r => r.id))
    const root = draft.variantOf || draft.id
    let n = 2; while (ids.has(`${root}-v${n}`)) n++
    const f = { ...clone(draft), id: `${root}-v${n}`, name: `${draft.name} v${n}`, variantOf: root }
    run(async () => { await saveFighter(f); setSelected(f.id) }, `Made ${f.name}`)
  }
  const cards = Array.isArray(draft.cards) ? draft.cards : []
  const setCard = (i, c) => { const d = clone(draft); d.cards[i] = c; setDraft(d) }
  const addCard = () => {
    const d = clone(draft)
    let n = d.cards.length + 1; while (d.cards.some(c => c.name === `New card ${n}`)) n++
    d.cards.push({ name: `New card ${n}`, type: 'strike', grey: 3, chip: 1, cooldown: 1 })
    setDraft(d); setEditing(d.cards.length - 1)
  }
  const removeCard = i => { const d = clone(draft); d.cards.splice(i, 1); setDraft(d); setEditing(null) }

  return html`<div class="stack" style=${{ gap: '20px' }}>
    <div class="spread">
      <div class="stack" style=${{ gap: '6px' }}>
        <div class="row"><h2>${draft.name || 'Unnamed'}</h2><${StatusChip} status=${entry.status} />${dirty ? html`<span class="changed-dot">Unsaved changes</span>` : null}</div>
        ${draft.concept ? html`<p class="lede small">${draft.concept}</p>` : null}
      </div>
      <${Seg} value=${view} options=${[['cards', 'Cards'], ['json', 'JSON']]} onChange=${setView} label="View" />
    </div>

    ${readOnly ? html`<div class="banner">You can view these move lists, but only editors of this page can change them.</div>` : null}
    ${entry.problems ? html`<div class="banner bad">The saved version of this fighter has problems, so matches use the bundled version until it's fixed: ${entry.problems.map(p => `${p.where}: ${p.msg}`).join(' ')}</div>` : null}

    <div class="actions">
      <button class="btn" disabled=${!dirty || v.errors.length > 0 || readOnly || offline || busy} onClick=${save}>Save</button>
      ${dirty ? html`<button class="btn ghost" onClick=${() => { setDraft(clone(baseline)); setEditing(null) }}>Discard changes</button>` : null}
      <button class="btn ghost small" disabled=${readOnly || offline || busy || dirty} onClick=${duplicate} title=${dirty ? 'Save or discard your changes first' : ''}>Duplicate as variant</button>
      ${entry.status === 'edited' && !dirty ? html`<button class="btn ghost small" disabled=${readOnly || busy} onClick=${() => setAsk('reset')}>Reset to the draft</button>` : null}
      ${entry.status === 'variant' && !dirty ? html`<button class="btn ghost small" disabled=${readOnly || busy} onClick=${() => setAsk('delete')}>Delete variant</button>` : null}
      <button class="link" onClick=${() => copyText(JSON.stringify(draft, null, 2))}>Copy JSON</button>
      <button class="link" onClick=${() => download(`${draft.id}.json`, JSON.stringify(draft, null, 2) + '\n').catch(e => toast(e.message))}>Download JSON</button>
    </div>
    ${ask === 'reset' ? html`<${Confirm} text=${`Reset ${entry.fighter.name} to the bundled draft? Your saved edits to this fighter will be lost.`} yes="Reset"
      onYes=${() => { setAsk(null); run(() => removeFighter(entry.id), 'Reset to the draft') }} onNo=${() => setAsk(null)} />` : null}
    ${ask === 'delete' ? html`<${Confirm} text=${`Delete ${entry.fighter.name}? Games already logged with it keep their copy.`} yes="Delete"
      onYes=${() => { setAsk(null); run(async () => { await removeFighter(entry.id); setSelected(null) }, 'Deleted') }} onNo=${() => setAsk(null)} />` : null}

    ${(v.errors.length || v.warnings.length) ? html`<div class="msgs" role="status">
      ${v.errors.map(e => html`<p class="msg-e">${e.where}: ${e.msg}</p>`)}
      ${v.warnings.map(e => html`<p class="msg-w">${e.where}: ${e.msg}</p>`)}
    </div>` : null}
    ${changes.length ? html`<div class="panel stack" style=${{ gap: '6px' }}>
      <span class="label">Changes from the bundled draft</span>
      ${changes.map(c => html`<p class="diff">${c}</p>`)}
    </div>` : null}

    ${view === 'json' ? html`<${JsonEditor} draft=${draft} setDraft=${setDraft} readOnly=${readOnly} />` : html`
      <${FighterFields} draft=${draft} setDraft=${setDraft} readOnly=${readOnly} />
      ${editing !== null && cards[editing] ? html`<${CardEditor} key=${editing} card=${cards[editing]} readOnly=${readOnly} rules=${rules}
        baseCard=${base ? base.cards.find(c => c.name === cards[editing].name) || base.cards[editing] || null : null}
        onChange=${c => setCard(editing, c)} onClose=${() => setEditing(null)} onRemove=${() => removeCard(editing)} />` : null}
      <div class="cards-grid">
        ${cards.map((c, i) => {
          const b = base ? base.cards.find(x => x.name === c.name) || null : null
          const changed = base && (!b || !same(b, c))
          const cv = validateCard(c)
          return html`<div key=${i}>
            <${CardFace} card=${c} rules=${rules} as="button" onClick=${() => setEditing(i)} cls=${editing === i ? 'selected' : ''} label=${`Edit ${c.name}`} />
            <div class="row" style=${{ gap: '8px' }}>
              <button class="link" onClick=${() => setEditing(i)}>${readOnly ? 'Details' : 'Edit'}</button>
              ${changed ? html`<span class="changed-dot">${b ? 'Changed' : 'New'}</span>` : null}
              ${cv.errors.length ? html`<span class="chip bad">${cv.errors.length} problem${cv.errors.length > 1 ? 's' : ''}</span>` : null}
            </div>
          </div>`
        })}
        ${!readOnly && cards.length < MAX_CARDS ? html`<div><button class="card add-card" type="button" onClick=${addCard}><span>+ Add a card</span></button></div>` : null}
      </div>
      <div class="stack" style=${{ gap: '8px' }}>
        <span class="label">The wheel these cards play on</span>
        <${Wheel} rules=${rules} />
        <p class="small muted">The base game gives every fighter one card of each type, told apart by its numbers and cooldown. A second card of a type is allowed for testing; the editor flags it as a guideline.</p>
      </div>`}
  </div>`
}

function FighterFields({ draft, setDraft, readOnly }) {
  const upd = patch => setDraft({ ...draft, ...patch })
  return html`<div class="panel grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
    <label class="field"><span>Name</span><input id="f-name" type="text" value=${draft.name} disabled=${readOnly} onInput=${e => upd({ name: e.target.value })} /></label>
    <label class="field"><span>Epithet</span><input id="f-epithet" type="text" value=${draft.epithet || ''} disabled=${readOnly} onInput=${e => upd({ epithet: e.target.value || undefined })} /></label>
    <label class="field"><span>HP</span><input id="f-hp" type="number" min="1" max="99" value=${draft.hp} disabled=${readOnly} onInput=${e => upd({ hp: toInt(e.target.value) })} /></label>
    <label class="field" style=${{ gridColumn: '1 / -1' }}><span>Concept (one line for the fighter picker)</span><input id="f-concept" type="text" value=${draft.concept || ''} disabled=${readOnly} onInput=${e => upd({ concept: e.target.value || undefined })} /></label>
  </div>`
}

const toInt = s => (s === '' ? 0 : Math.trunc(Number(s)))

function CardEditor({ card, readOnly, baseCard, onChange, onClose, onRemove, rules }) {
  const v = validateCard(card)
  const t = TYPE_CODE[card.type] || 'S'
  const set = patch => {
    const c = { ...card, ...patch }
    for (const [k, val] of Object.entries(patch)) if (val === undefined) delete c[k]
    onChange(c)
  }
  // changing type keeps only the numbers that type prints
  const setType = type => {
    const nt = TYPE_CODE[type]
    set({ type, grey: nt === 'S' ? card.grey ?? 3 : undefined, chip: nt === 'S' || nt === 'H' || nt === 'G' ? card.chip ?? (nt === 'S' ? 1 : 2) : undefined })
  }
  const changedFrom = baseCard && !same(baseCard, card) ? diffCard(baseCard, card) : []
  return html`<div class="panel stack" style=${{ gap: '16px' }} aria-label=${`Editing ${card.name}`}>
    <div class="spread"><h3>Card · ${card.name}</h3><div class="row">
      ${!readOnly ? html`<button class="link" onClick=${onRemove}>Remove card</button>` : null}
      <button class="link" onClick=${onClose}>Close</button>
    </div></div>
    <div class="card-ed">
      <${CardFace} card=${card} rules=${rules} />
      <fieldset class="stack" style=${{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled=${readOnly}>
        <div class="grid3">
          <label class="field" style=${{ gridColumn: 'span 2' }}><span>Name</span><input id="c-name" type="text" value=${card.name} onInput=${e => set({ name: e.target.value })} /></label>
          <label class="field"><span>Type</span>
            <select id="c-type" value=${card.type} onChange=${e => setType(e.target.value)}>
              ${TYPES.map(x => html`<option value=${x}>${TYPE_LABEL[TYPE_CODE[x]]}</option>`)}
            </select>
          </label>
          ${t === 'S' ? html`<label class="field"><span>Grey</span><input id="c-grey" type="number" min="0" max="20" value=${card.grey ?? 0} onInput=${e => set({ grey: toInt(e.target.value) })} /></label>` : null}
          ${t === 'S' || t === 'H' || t === 'G' ? html`<label class="field"><span>Chip</span><input id="c-chip" type="number" min="0" max="20" value=${card.chip ?? 0} onInput=${e => set({ chip: toInt(e.target.value) })} /></label>` : null}
          <label class="field"><span>Cooldown</span>
            <select id="c-cd" value=${String(card.cooldown ?? 1)} onChange=${e => set({ cooldown: Number(e.target.value) })}><option value="1">1 reveal</option><option value="2">2 reveals</option></select>
          </label>
        </div>
        <p class="small muted">${winText(card, rules)} ${{
          S: 'More Grey builds bigger piles but hands more back when blocked: quick moves are low Grey.',
          H: 'A Heavy prints no Grey, so a Block simply stops it.',
          G: 'Grab is the only attack that beats Block.',
          F: 'Focus never deals damage, so it prints no numbers.',
          B: 'Block never deals damage, so it prints no numbers.',
        }[t]}</p>
        <label class="field"><span>Notes (not shown on the card)</span><input id="c-notes" type="text" value=${card.notes || ''} onInput=${e => set({ notes: e.target.value || undefined })} /></label>
        <label class="field"><span>Card art (image URL, replaces the generated face)</span><input id="c-art" type="text" placeholder="Leave blank to use the generated face" value=${card.art || ''} onInput=${e => set({ art: e.target.value || undefined })} /></label>
      </fieldset>
    </div>
    ${(v.errors.length || v.warnings.length) ? html`<div class="msgs">
      ${v.errors.map(m => html`<p class="msg-e">${m}</p>`)}${v.warnings.map(m => html`<p class="msg-w">${m}</p>`)}
    </div>` : null}
    ${changedFrom.length ? html`<div class="stack" style=${{ gap: '4px' }}><span class="label">Changed from the draft</span>${changedFrom.map(c => html`<p class="diff">${c}</p>`)}</div>` : null}
  </div>`
}

function JsonEditor({ draft, setDraft, readOnly }) {
  const [text, setText] = useState(() => JSON.stringify(draft, null, 2))
  const [err, setErr] = useState(null)
  useEffect(() => {
    try { if (!same(JSON.parse(text), draft)) setText(JSON.stringify(draft, null, 2)) } catch { /* keep typing */ }
  }, [stableStringify(draft)])
  const onInput = e => {
    const s = e.target.value
    setText(s)
    try { const f = JSON.parse(s); setErr(null); setDraft(f) } catch (x) { setErr(x.message) }
  }
  return html`<div class="stack" style=${{ gap: '8px' }}>
    <p class="small muted">The fighter as it's stored. Edits here update the cards as you type; problems show above. Card fields: name, type (strike, heavy, grab, focus, block), cooldown (1 or 2), "grey" (Strikes only) and "chip" (Strikes, Heavies and Grabs), plus optional "notes" and "art".</p>
    <textarea id="json" rows="28" spellcheck="false" value=${text} onInput=${onInput} readOnly=${readOnly} aria-label="Fighter JSON"></textarea>
    ${err ? html`<p class="msg-e">That isn't valid JSON yet: ${err}</p>` : null}
  </div>`
}

// ---- differences, in words ----------------------------------------------------
const FIELDS = [['type', 'Type'], ['grey', 'Grey'], ['chip', 'Chip'], ['cooldown', 'Cooldown']]
export function diffCard(a, b) {
  const out = [], nm = b.name
  if (a.name !== b.name) out.push(`${a.name} renamed ${b.name}`)
  for (const [k, label] of FIELDS) {
    const x = a[k] ?? (k === 'cooldown' ? 1 : null), y = b[k] ?? (k === 'cooldown' ? 1 : null)
    if (x !== y) out.push(`${nm}: ${label} ${x ?? 'none'} → ${y ?? 'none'}`)
  }
  if ((a.art || '') !== (b.art || '')) out.push(`${nm}: card art ${b.art ? 'set' : 'removed'}`)
  return out
}
export function diffFighter(a, b) {
  const out = []
  if (a.name !== b.name) out.push(`Name ${a.name} → ${b.name}`)
  if (a.hp !== b.hp) out.push(`HP ${a.hp} → ${b.hp}`)
  const bc = Array.isArray(b.cards) ? b.cards : []
  for (const c of a.cards) {
    const m = bc.find(x => x.name === c.name)
    if (!m) { if (!bc[a.cards.indexOf(c)]) out.push(`Removed card ${c.name}`) }
    else out.push(...diffCard(c, m))
  }
  bc.forEach((c, i) => {
    if (a.cards.some(x => x.name === c.name)) return
    const old = a.cards[i]
    if (old && !bc.some(x => x.name === old.name)) out.push(...diffCard(old, c))
    else out.push(`Added card ${c.name}`)
  })
  return out
}
