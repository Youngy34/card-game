// Move lists: view and edit every fighter's cards, as a form or as raw JSON.
// Edits save to the artifact's database; the bundled drafts stay untouched, so
// any fighter can be reset. (Carried over from the v11/v12 app, with the card
// form rebuilt for card format v3.)

import { html, cx, useState, useEffect, useMemo } from './lib.js'
import { CardFace, UniversalFace } from './card.js'
import { Confirm, StatusChip, copyText, toast, Seg } from './ui.js'
import { roster, saveFighter, removeFighter, getState, download } from './store.js'
import { validateFighter, validateCard, stableStringify, MAX_CARDS } from '../engine/fighters.js'
import { UNIVERSAL, comboLine } from '../engine/rules.js'

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
      <details class="panel details" style=${{ marginTop: '8px' }}>
        <summary class="spread"><span class="label">Universal cards</span><span class="small muted">Show</span></summary>
        <div class="stack" style=${{ marginTop: '10px', gap: '8px' }}>
          ${Object.values(UNIVERSAL).map(u => html`<p class="small"><b>${u.name}</b> · ${u.neutral || u.combo}${u.id === 'G' ? ` ${u.combo}` : ''}</p>`)}
        </div>
      </details>
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
    d.cards.push({ name: `New card ${n}`, direction: 'horizontal', speed: 5, hit: 2, onBlock: '-', linker: 'medium', grey: 3, cooldown: 1 })
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
      ${editing !== null && cards[editing] ? html`<${CardEditor} key=${editing} card=${cards[editing]} readOnly=${readOnly}
        baseCard=${base ? base.cards.find(c => c.name === cards[editing].name) || base.cards[editing] || null : null}
        onChange=${c => setCard(editing, c)} onClose=${() => setEditing(null)} onRemove=${() => removeCard(editing)} />` : null}
      <div class="cards-grid">
        ${cards.map((c, i) => {
          const b = base ? base.cards.find(x => x.name === c.name) || null : null
          const changed = base && (!b || !same(b, c))
          const cv = validateCard(c)
          return html`<div key=${i}>
            <${CardFace} card=${c} as="button" onClick=${() => setEditing(i)} cls=${editing === i ? 'selected' : ''} label=${`Edit ${c.name}`} />
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
        <span class="label">Universal cards, shared by every fighter</span>
        <div class="cards-grid small-cards">
          ${['G', 'D', 'S', 'BL', 'BM', 'BH'].map(id => html`<div><${UniversalFace} card=${UNIVERSAL[id]} /></div>`)}
        </div>
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

function CardEditor({ card, readOnly, baseCard, onChange, onClose, onRemove }) {
  const v = validateCard(card)
  const isThrow = card.direction === 'throw'
  const role = card.linker ? 'linker' : card.ender ? 'ender' : 'none'
  const set = patch => {
    const c = { ...card, ...patch }
    for (const [k, val] of Object.entries(patch)) if (val === undefined) delete c[k]
    onChange(c)
  }
  const setDirection = d => {
    if (d === 'throw') set({ direction: d, onBlock: undefined, linker: undefined, ender: undefined, bonus: undefined, keepInitiative: undefined, blockGrey: undefined, grey: card.grey && !card.linker ? card.grey : undefined })
    else set({ direction: d, onBlock: card.onBlock ?? '-', grey: card.linker ? card.grey : undefined })
  }
  const setRole = r => {
    if (r === 'linker') set({ linker: card.linker || 'medium', grey: card.grey || 3, ender: undefined, bonus: undefined, keepInitiative: undefined })
    else if (r === 'ender') set({ ender: true, linker: undefined, grey: undefined })
    else set({ linker: undefined, grey: undefined, ender: undefined, bonus: undefined, keepInitiative: undefined })
  }
  const changedFrom = baseCard && !same(baseCard, card) ? diffCard(baseCard, card) : []
  return html`<div class="panel stack" style=${{ gap: '16px' }} aria-label=${`Editing ${card.name}`}>
    <div class="spread"><h3>Card · ${card.name}</h3><div class="row">
      ${!readOnly ? html`<button class="link" onClick=${onRemove}>Remove card</button>` : null}
      <button class="link" onClick=${onClose}>Close</button>
    </div></div>
    <div class="card-ed">
      <${CardFace} card=${card} guard=${card.blockGrey !== undefined} />
      <fieldset class="stack" style=${{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled=${readOnly}>
        <div class="grid3">
          <label class="field" style=${{ gridColumn: 'span 2' }}><span>Name</span><input id="c-name" type="text" value=${card.name} onInput=${e => set({ name: e.target.value })} /></label>
          <label class="field"><span>Direction</span>
            <select id="c-dir" value=${card.direction} onChange=${e => setDirection(e.target.value)}>
              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="throw">Throw</option>
            </select>
          </label>
          <label class="field"><span>Speed (1–10)</span><input id="c-speed" type="number" min="1" max="10" value=${card.speed} onInput=${e => set({ speed: toInt(e.target.value) })} /></label>
          <label class="field"><span>Hit</span><input id="c-hit" type="number" min="0" max="20" value=${card.hit} onInput=${e => set({ hit: toInt(e.target.value) })} /></label>
          ${!isThrow ? html`<label class="field"><span>On block</span>
            <select id="c-ob" value=${card.onBlock === '−' ? '-' : card.onBlock} onChange=${e => set({ onBlock: e.target.value })}>
              <option value="+">+ striker takes the initiative</option><option value="=">= initiative stays</option><option value="-">− blocker takes it</option>
            </select>
          </label>` : null}
          <label class="field"><span>Cooldown</span>
            <select id="c-cd" value=${String(card.cooldown ?? 1)} onChange=${e => set({ cooldown: Number(e.target.value) })}><option value="1">1 reveal</option><option value="2">2 reveals</option></select>
          </label>
          ${!isThrow ? html`<label class="field" title="Used only by the guard damage experiment (Settings)"><span>Block grey (guard damage)</span><input id="c-bgrey" type="number" min="0" placeholder="1" value=${card.blockGrey ?? ''} onInput=${e => set({ blockGrey: e.target.value === '' ? undefined : toInt(e.target.value) })} /></label>` : null}
          ${isThrow ? html`<label class="field"><span>Grey on throw</span><input id="c-tgrey" type="number" min="0" value=${card.grey ?? 0} onInput=${e => set({ grey: toInt(e.target.value) || undefined })} /></label>` : null}
        </div>
        ${!isThrow ? html`<div class="stack" style=${{ gap: '8px' }}>
          <span class="label">Combo role</span>
          <${Seg} value=${role} options=${[['linker', 'Linker'], ['ender', 'Ender'], ['none', 'None']]} onChange=${setRole} label="Combo role" />
          ${role === 'linker' ? html`<div class="grid3">
            <label class="field"><span>Strength</span><select id="c-str" value=${card.linker} onChange=${e => set({ linker: e.target.value })}>
              <option value="light">Light</option><option value="medium">Medium</option><option value="heavy">Heavy</option></select></label>
            <label class="field"><span>Grey</span><input id="c-grey" type="number" min="1" value=${card.grey ?? 1} onInput=${e => set({ grey: toInt(e.target.value) })} /></label>
          </div>` : null}
          ${role === 'ender' ? html`<div class="grid3">
            <label class="field"><span>Bonus damage</span><input id="c-bonus" type="number" min="0" value=${card.bonus ?? 0} onInput=${e => set({ bonus: toInt(e.target.value) || undefined })} /></label>
            <label class="check" style=${{ alignSelf: 'end' }}><input id="c-keep" type="checkbox" checked=${!!card.keepInitiative} onChange=${e => set({ keepInitiative: e.target.checked || undefined })} /> You keep the initiative</label>
          </div>` : null}
          ${role !== 'none' ? html`<p class="small muted">${comboLine(card)}</p>` : html`<p class="small muted">A strike with no combo role: it can open a combo, but can't be played during one.</p>`}
        </div>` : html`<p class="small muted">Throws can never be linkers or enders. A throw that lands deals its Hit, adds its grey to the pile and takes the initiative, with no combo.</p>`}
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
    <p class="small muted">The fighter as it's stored. Edits here update the cards as you type; problems show above. Card fields: name, direction (horizontal, vertical, throw), speed, hit, onBlock ("+", "=", "-"), cooldown, then either "linker" (light, medium, heavy) with "grey", or "ender": true with optional "bonus" and "keepInitiative": true. A throw may have "grey". A strike may have "blockGrey", used only by the guard damage experiment.</p>
    <textarea id="json" rows="28" spellcheck="false" value=${text} onInput=${onInput} readOnly=${readOnly} aria-label="Fighter JSON"></textarea>
    ${err ? html`<p class="msg-e">That isn't valid JSON yet: ${err}</p>` : null}
  </div>`
}

// ---- differences, in words ----------------------------------------------------
const FIELDS = [['direction', 'Direction'], ['speed', 'Speed'], ['hit', 'Hit'], ['onBlock', 'On block'], ['cooldown', 'Cooldown'],
                ['linker', 'Linker'], ['grey', 'Grey'], ['ender', 'Ender'], ['bonus', 'Bonus'], ['keepInitiative', 'Keeps the initiative'],
                ['blockGrey', 'Block grey']]
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
