// Move lists: view and edit every fighter's cards, as a form or as raw JSON.
// Edits save to the artifact's database; the bundled signed-off versions stay
// untouched, so any fighter can be reset.

import { html, cx, useState, useEffect, useMemo } from './lib.js'
import { CardFace } from './card.js'
import { Confirm, StatusChip, copyText, toast, Seg } from './ui.js'
import { roster, saveFighter, removeFighter, getState, download } from './store.js'
import { validateFighter, validateCard, stableStringify } from '../engine/fighters.js'
import { KEYWORDS, KEYWORD, TYPES, TYPE_CODE, CODE_TYPE, BEATEN_BY, PASSIVES, cardLines, KINDS, kindsOf, kindLine, SPEED_BAND, DEFAULT_SPEED } from '../engine/keywords.js'

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
  const [baseline, setBaseline] = useState(() => clone(entry.fighter))   // the saved version the draft started from
  const [view, setView] = useState('cards')
  const [editing, setEditing] = useState(null)          // card index, or 'S'
  const [ask, setAsk] = useState(null)
  const [busy, setBusy] = useState(false)
  const st = getState()
  const readOnly = st.canEdit === false
  const offline = st.backend === 'connecting'
  const dirty = !same(draft, baseline)

  // follow the saved version when it changes (a save, a reset, another device),
  // keeping unsaved edits if there are any
  useEffect(() => {
    if (same(draft, baseline) || same(draft, entry.fighter)) setDraft(clone(entry.fighter))
    setBaseline(clone(entry.fighter))
  }, [entry.hash])

  const v = useMemo(() => validateFighter(draft), [stableStringify(draft)])
  const hasFlow = !!draft.passive?.flow
  const v12 = draft.rules === 12
  const rv = draft.rules === 12 || draft.rules === 15 ? draft.rules : 11
  const base = entry.base
  const changes = base ? diffFighter(base, draft) : []
  const baseWord = entry.reference ? 'bundled' : 'signed-off', resetWord = entry.reference ? 'bundled' : 'signed off'

  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast(ok) } catch (e) { toast(e.message || 'That didn\'t work.') }
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
  const setCard = (i, c) => {
    const d = clone(draft)
    if (i === 'S') d.super = c; else d.cards[i] = c
    setDraft(d)
  }

  return html`<div class="stack" style=${{ gap: '20px' }}>
    <div class="spread">
      <div class="stack" style=${{ gap: '6px' }}>
        <div class="row"><h2>${draft.name || 'Unnamed'}</h2><${StatusChip} status=${entry.status} />${dirty ? html`<span class="changed-dot">Unsaved changes</span>` : null}</div>
        ${draft.concept ? html`<p class="lede small">${draft.concept}</p>` : null}
      </div>
      <${Seg} value=${view} options=${[['cards', 'Cards'], ['json', 'JSON']]} onChange=${setView} label="View" />
    </div>

    ${readOnly ? html`<div class="banner">You can view these move lists, but only editors of this page can change them.</div>` : null}
    ${entry.problems ? html`<div class="banner bad">The saved version of this fighter has problems, so matches use the signed-off version until it's fixed: ${entry.problems.map(p => `${p.where}: ${p.msg}`).join(' ')}</div>` : null}

    <div class="actions">
      <button class="btn" disabled=${!dirty || v.errors.length > 0 || readOnly || offline || busy} onClick=${save}>Save</button>
      ${dirty ? html`<button class="btn ghost" onClick=${() => { setDraft(clone(baseline)); setEditing(null) }}>Discard changes</button>` : null}
      <button class="btn ghost small" disabled=${readOnly || offline || busy || dirty} onClick=${duplicate} title=${dirty ? 'Save or discard your changes first' : ''}>Duplicate as variant</button>
      ${entry.status === 'edited' && !dirty ? html`<button class="btn ghost small" disabled=${readOnly || busy} onClick=${() => setAsk('reset')}>Reset to ${resetWord}</button>` : null}
      ${entry.status === 'variant' && !dirty ? html`<button class="btn ghost small" disabled=${readOnly || busy} onClick=${() => setAsk('delete')}>Delete variant</button>` : null}
      <button class="link" onClick=${() => copyText(JSON.stringify(draft, null, 2))}>Copy JSON</button>
      <button class="link" onClick=${() => download(`${draft.id}.json`, JSON.stringify(draft, null, 2) + '\n').catch(e => toast(e.message))}>Download JSON</button>
    </div>
    ${ask === 'reset' ? html`<${Confirm} text=${`Reset ${entry.fighter.name} to the ${baseWord} version? Your saved edits to this fighter will be lost.`} yes="Reset"
      onYes=${() => { setAsk(null); run(() => removeFighter(entry.id), `Reset to ${resetWord}`) }} onNo=${() => setAsk(null)} />` : null}
    ${ask === 'delete' ? html`<${Confirm} text=${`Delete ${entry.fighter.name}? Games already logged with it keep their copy.`} yes="Delete"
      onYes=${() => { setAsk(null); run(async () => { await removeFighter(entry.id); setSelected(null) }, 'Deleted') }} onNo=${() => setAsk(null)} />` : null}

    ${(v.errors.length || v.warnings.length) ? html`<div class="msgs" role="status">
      ${v.errors.map(e => html`<p class="msg-e">${e.where}: ${e.msg}</p>`)}
      ${v.warnings.map(e => html`<p class="msg-w">${e.where}: ${e.msg}</p>`)}
    </div>` : null}
    ${changes.length ? html`<div class="panel stack" style=${{ gap: '6px' }}>
      <span class="label">Changes from the ${baseWord} version</span>
      ${changes.map(c => html`<p class="diff">${c}</p>`)}
    </div>` : null}

    ${view === 'json' ? html`<${JsonEditor} draft=${draft} setDraft=${setDraft} readOnly=${readOnly} />` : html`
      <${FighterFields} draft=${draft} setDraft=${setDraft} readOnly=${readOnly} />
      ${editing !== null && (editing === 'S' ? draft.super : draft.cards[editing]) ? html`<${CardEditor} key=${editing} card=${editing === 'S' ? draft.super : draft.cards[editing]}
        isSuper=${editing === 'S'} hasFlow=${hasFlow} rules=${rv} readOnly=${readOnly}
        baseCard=${base ? (editing === 'S' ? base.super : base.cards[editing]) || null : null}
        onChange=${c => setCard(editing, c)} onClose=${() => setEditing(null)} />` : null}
      <div class="cards-grid">
        ${[...draft.cards.map((c, i) => [i, c]), ...(draft.super ? [['S', draft.super]] : [])].map(([i, c]) => {
          const b = base ? (i === 'S' ? base.super : base.cards[i]) || null : null
          const changed = b && !same(b, c)
          const cv = validateCard(c, { isSuper: i === 'S', hasFlow, v12, v15: rv === 15 })
          return html`<div key=${i}>
            <${CardFace} card=${c} isSuper=${i === 'S'} hasFlow=${hasFlow} rules=${rv} as="button" onClick=${() => setEditing(i)}
              cls=${editing === i ? 'selected' : ''} label=${`Edit ${c.name}`} />
            <div class="row" style=${{ gap: '8px' }}>
              <button class="link" onClick=${() => setEditing(i)}>${readOnly ? 'Details' : 'Edit'}</button>
              ${changed ? html`<span class="changed-dot">Changed</span>` : null}
              ${cv.errors.length ? html`<span class="chip bad">${cv.errors.length} problem${cv.errors.length > 1 ? 's' : ''}</span>` : null}
            </div>
          </div>`
        })}
      </div>`}
  </div>`
}

function FighterFields({ draft, setDraft, readOnly }) {
  const upd = patch => setDraft({ ...draft, ...patch })
  const passive = draft.passive?.flow ? 'flow' : draft.passive?.risingStakes ? 'risingStakes' : ''
  const setPassive = p => upd({ passive: p === 'flow' ? { flow: true } : p === 'risingStakes' ? { risingStakes: { tokens: 1 } } : null })
  return html`<div class="panel grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
    <label class="field"><span>Name</span><input id="f-name" type="text" value=${draft.name} disabled=${readOnly} onInput=${e => upd({ name: e.target.value })} /></label>
    <label class="field"><span>Epithet</span><input id="f-epithet" type="text" value=${draft.epithet || ''} disabled=${readOnly} onInput=${e => upd({ epithet: e.target.value || undefined })} /></label>
    <label class="field" title="Rules v12 and v15 add kinds and speed. Switching a fighter's rules doesn't convert its cards: fix what the checks list."><span>Rules</span>
      <select id="f-rules" value=${String(draft.rules === 12 || draft.rules === 15 ? draft.rules : 11)} disabled=${readOnly} onChange=${e => upd({ rules: e.target.value === '11' ? undefined : Number(e.target.value) })}>
        <option value="11">v11 (signed-off roster)</option>
        <option value="12">v12 (kinds, speed, turn-backs)</option>
        <option value="15">v15 (v11 core, speed, follow-ups)</option>
      </select>
    </label>
    <label class="field"><span>Base HP</span><input id="f-hp" type="number" min="1" max="99" value=${draft.hp} disabled=${readOnly} onInput=${e => upd({ hp: toInt(e.target.value) })} /></label>
    <label class="field"><span>Passive</span>
      <select id="f-passive" value=${passive} disabled=${readOnly} onChange=${e => setPassive(e.target.value)}>
        <option value="">None</option>
        ${Object.entries(PASSIVES).map(([k, p]) => html`<option value=${k}>${p.label}</option>`)}
      </select>
    </label>
    ${passive === 'risingStakes' ? html`
      <label class="field"><span>Rising Stakes tokens</span><input id="f-rs" type="number" min="1" value=${draft.passive.risingStakes.tokens} disabled=${readOnly}
        onInput=${e => upd({ passive: { risingStakes: { ...draft.passive.risingStakes, tokens: toInt(e.target.value) } } })} /></label>
      <label class="field"><span>Only while pile under (blank = always)</span><input id="f-rs-cap" type="number" min="1" value=${draft.passive.risingStakes.whilePileUnder ?? ''} disabled=${readOnly}
        onInput=${e => { const rs = { ...draft.passive.risingStakes }; const n = toInt(e.target.value); if (e.target.value === '') delete rs.whilePileUnder; else rs.whilePileUnder = n; upd({ passive: { risingStakes: rs } }) }} /></label>` : null}
    <label class="field" title="How the sparring partner values its own grey tokens, in HP. The Gambler's player uses 0.3 because her grey is her fuel."><span>Partner values own grey at (HP)</span>
      <input id="f-alpha" type="number" step="0.05" min="0" max="2" placeholder="0.6 (default)" value=${draft.ai?.ownGreyValue ?? ''} disabled=${readOnly}
        onInput=${e => { const x = e.target.value === '' ? null : Number(e.target.value); upd({ ai: x === null ? undefined : { ownGreyValue: x } }) }} />
    </label>
    ${passive ? html`<p class="small muted" style=${{ gridColumn: '1 / -1' }}>${PASSIVES[passive].text(draft.passive[passive])}</p>` : null}
  </div>`
}

const toInt = s => (s === '' ? 0 : Math.trunc(Number(s)))

function defaultValue(k, t) {
  if (k.kind === 'bool') return true
  if (k.kind === 'pair') return { tokens: 4, build: 2 }
  if (k.kind === 'choice') return k.options[0][0]
  if (k.kind === 'type') return CODE_TYPE[t === 'T' ? 'C' : BEATEN_BY[t]]
  return k.key.startsWith('chipPer') || k.key.startsWith('buildPer') ? 2 : 1
}

function CardEditor({ card, isSuper, hasFlow, rules = 11, readOnly, baseCard, onChange, onClose }) {
  const t = TYPE_CODE[card.type]
  const kinded = rules === 12 || rules === 15
  const v = validateCard(card, { isSuper, hasFlow, v12: rules === 12, v15: rules === 15 })
  const [note, setNote] = useState(null)
  const set = patch => {
    const c = { ...card, ...patch }
    for (const [k, val] of Object.entries(patch)) if (val === undefined) delete c[k]
    onChange(c)
  }
  const changeType = type => {
    const nt = TYPE_CODE[type]
    const c = { ...card, type }
    const removed = []
    for (const k of KEYWORDS) {
      if (c[k.key] === undefined) continue
      if (!k.types.includes(nt)) { removed.push(k.label); delete c[k.key] }
      else if (k.kind === 'type') {
        const T = TYPE_CODE[c[k.key]]
        if (nt !== 'T' && BEATEN_BY[T] === nt) { removed.push(k.label); delete c[k.key] }
      }
    }
    if (nt === 'P') c.build = c.build || 3; else delete c.build
    if (nt === 'C' && !(c.chip > 0)) c.chip = 2
    if (kinded) {                                // a kind and speed that fit the new type
      if (!kindsOf(nt, rules).includes(c.kind)) c.kind = kindsOf(nt, rules)[0]
      if (c.kind === undefined) delete c.kind
      if (SPEED_BAND[nt]) { const [lo, hi] = SPEED_BAND[nt]; if (!(c.speed >= lo && c.speed <= hi)) c.speed = DEFAULT_SPEED[c.kind] }
      else delete c.speed
      if (nt === 'R' || nt === 'T') delete c.chip
    }
    setNote(removed.length ? `Removed what a ${type} card can't have: ${removed.join(', ')}.` : null)
    onChange(c)
  }
  const present = KEYWORDS.filter(k => card[k.key] !== undefined && card[k.key] !== null && card[k.key] !== false)
  const addable = KEYWORDS.filter(k => !present.includes(k) && k.types.includes(t) && !(isSuper && k.superOk === false) && !(!isSuper && k.superOnly) && (!k.needsFlow || hasFlow))
  const lines = cardLines(card, { isSuper })
  const changedFrom = baseCard && !same(baseCard, card) ? diffCard(baseCard, card) : []

  return html`<div class="panel stack" style=${{ gap: '16px' }} aria-label=${`Editing ${card.name}`}>
    <div class="spread"><h3>${isSuper ? 'Super' : 'Card'} · ${card.name}</h3><button class="link" onClick=${onClose}>Close</button></div>
    <div class="card-ed">
      <${CardFace} card=${card} isSuper=${isSuper} hasFlow=${hasFlow} rules=${rules} />
      <fieldset class="stack" style=${{ border: 0, padding: 0, margin: 0 }} disabled=${readOnly}>
        <div class="grid3">
          <label class="field" style=${{ gridColumn: 'span 2' }}><span>Name</span><input id="c-name" type="text" value=${card.name} onInput=${e => set({ name: e.target.value })} /></label>
          <label class="field"><span>Type</span>
            <select id="c-type" value=${card.type} onChange=${e => changeType(e.target.value)}>
              ${TYPES.map(x => html`<option value=${x}>${x[0].toUpperCase() + x.slice(1)}</option>`)}
            </select>
          </label>
          ${kinded && kindsOf(t, rules).length ? html`<label class="field"><span>Kind</span>
            <select id="c-kind" value=${card.kind || ''} onChange=${e => set({ kind: e.target.value })}>
              ${!kindsOf(t, rules).includes(card.kind) ? html`<option value="">Choose…</option>` : null}
              ${kindsOf(t, rules).map(k => html`<option value=${k}>${KINDS[k].label}</option>`)}
            </select>
          </label>` : null}
          ${kinded && SPEED_BAND[t] ? html`<label class="field"><span>Speed (${SPEED_BAND[t][0]}–${SPEED_BAND[t][1]}, higher is faster)</span><input id="c-speed" type="number" min=${SPEED_BAND[t][0]} max=${SPEED_BAND[t][1]} value=${card.speed ?? ''} onInput=${e => set({ speed: toInt(e.target.value) })} /></label>` : null}
          ${t === 'P' ? html`<label class="field"><span>Build</span><input id="c-build" type="number" min="1" value=${card.build ?? 0} onInput=${e => set({ build: toInt(e.target.value) })} /></label>` : null}
          ${kinded && (t === 'R' || t === 'T') && !card.chip ? null : html`<label class="field"><span>Chip</span><input id="c-chip" type="number" min="0" value=${card.chip ?? 0} onInput=${e => set({ chip: toInt(e.target.value) })} /></label>`}
          ${!isSuper ? html`<label class="field"><span>Cooldown</span>
            <select id="c-cd" value=${String(card.cooldown ?? 1)} onChange=${e => set({ cooldown: Number(e.target.value) })}><option value="1">1 round</option><option value="2">2 rounds</option></select>
          </label>` : null}
        </div>
        ${!isSuper && (hasFlow || card.flowCard) ? html`<label class="check"><input id="c-flow" type="checkbox" checked=${!!card.flowCard} onChange=${e => set({ flowCard: e.target.checked || undefined })} /> Flow card (the Flow passive reads it on cooldown space 1)</label>` : null}
        ${note ? html`<p class="small msg-w">${note}</p>` : null}

        <div class="stack" style=${{ gap: '8px' }}>
          <span class="label">Effects and costs</span>
          ${kinded && kindLine(card, rules) ? html`<p class="small muted">${rules === 15 ? 'Rules v15' : `As a ${KINDS[card.kind]?.label}`}: ${kindLine(card, rules)}</p>` : null}
          ${present.length === 0 ? html`<p class="small muted">No text: the card does its type effect${t === 'T' ? ' (none, for a typeless card)' : ''} and its chip.</p>` : null}
          ${present.map(k => html`<${KeywordRow} k=${k} t=${t} value=${card[k.key]} onChange=${val => set({ [k.key]: val })} onRemove=${() => set({ [k.key]: undefined })} />`)}
          ${addable.length && !readOnly ? html`<label class="field" style=${{ maxWidth: '360px' }}><span>Add an effect or cost</span>
            <select id="c-add" value="" onChange=${e => { const k = KEYWORD[e.target.value]; if (k) set({ [k.key]: defaultValue(k, t) }); e.target.value = '' }}>
              <option value="">Choose…</option>
              <optgroup label="Effects">${addable.filter(k => k.zone !== 'cost').map(k => html`<option value=${k.key}>${k.label}</option>`)}</optgroup>
              <optgroup label="Costs">${addable.filter(k => k.zone === 'cost').map(k => html`<option value=${k.key}>${k.label}</option>`)}</optgroup>
            </select>
          </label>` : null}
        </div>
        ${isSuper ? html`<label class="field"><span>Flavour line</span><input id="c-flavour" type="text" value=${card.flavour || ''} onInput=${e => set({ flavour: e.target.value || undefined })} /></label>` : null}
        <label class="field"><span>Card art (image URL, replaces the generated face)</span><input id="c-art" type="text" placeholder="Leave blank to use the generated face" value=${card.art || ''} onInput=${e => set({ art: e.target.value || undefined })} /></label>
      </fieldset>
    </div>
    ${(v.errors.length || v.warnings.length) ? html`<div class="msgs">
      ${v.errors.map(m => html`<p class="msg-e">${m}</p>`)}${v.warnings.map(m => html`<p class="msg-w">${m}</p>`)}
    </div>` : null}
    ${changedFrom.length ? html`<div class="stack" style=${{ gap: '4px' }}><span class="label">Changed from signed off</span>${changedFrom.map(c => html`<p class="diff">${c}</p>`)}</div>` : null}
    ${lines.text.length + lines.cost.length === 0 ? null : html`<p class="small muted">Card text is written from the effects, so the face always matches what the engine does.</p>`}
  </div>`
}

function KeywordRow({ k, t, value, onChange, onRemove }) {
  const preview = k.text(value, t)
  return html`<div class=${cx('kw', k.zone === 'cost' && 'cost')}>
    <p class="kw-title">${k.label} <em>· ${preview}</em></p>
    <div class="kw-inputs">
      ${k.kind === 'int' ? html`<label class="field"><span>${k.unit || 'Amount'}</span><input id=${'kw-' + k.key} type="number" min=${k.min} max=${k.max} value=${value} onInput=${e => onChange(toInt(e.target.value))} /></label>` : null}
      ${k.kind === 'pair' ? k.fields.map(f => html`<label class="field"><span>${f.label}</span><input id=${'kw-' + k.key + '-' + f.key} type="number" min=${f.min} max=${f.max} value=${value[f.key]} onInput=${e => onChange({ ...value, [f.key]: toInt(e.target.value) })} /></label>`) : null}
      ${k.kind === 'choice' ? html`<label class="field"><span>When</span><select id=${'kw-' + k.key} value=${value} onChange=${e => onChange(e.target.value)}>
        ${k.options.map(([v, l]) => html`<option value=${v}>${l}</option>`)}
      </select></label>` : null}
      ${k.kind === 'type' ? html`<label class="field"><span>Type</span><select id=${'kw-' + k.key} value=${value} onChange=${e => onChange(e.target.value)}>
        ${['pressure', 'convert', 'recover'].map(x => html`<option value=${x}>${x[0].toUpperCase() + x.slice(1)}</option>`)}
      </select></label>` : null}
    </div>
    <button class="link" onClick=${onRemove} type="button">Remove</button>
  </div>`
}

function JsonEditor({ draft, setDraft, readOnly }) {
  const [text, setText] = useState(() => JSON.stringify(draft, null, 2))
  const [err, setErr] = useState(null)
  useEffect(() => {
    // follow form edits made elsewhere, unless the text is mid-edit and invalid
    try { if (!same(JSON.parse(text), draft)) setText(JSON.stringify(draft, null, 2)) } catch { /* keep typing */ }
  }, [stableStringify(draft)])
  const onInput = e => {
    const s = e.target.value
    setText(s)
    try { const f = JSON.parse(s); setErr(null); setDraft(f) } catch (x) { setErr(x.message) }
  }
  return html`<div class="stack" style=${{ gap: '8px' }}>
    <p class="small muted">The fighter as it's stored. Edits here update the cards as you type; problems show above. Field names are listed in the README's card format section.</p>
    <textarea id="json" rows="28" spellcheck="false" value=${text} onInput=${onInput} readOnly=${readOnly} aria-label="Fighter JSON"></textarea>
    ${err ? html`<p class="msg-e">That isn't valid JSON yet: ${err}</p>` : null}
  </div>`
}

// ---- differences, in words -----------------------------------------------
function keyText(c, k) {
  const v = c[k.key]
  if (v === undefined || v === null || v === false) return null
  return k.text(v, TYPE_CODE[c.type])
}
export function diffCard(a, b) {
  const out = []
  const nm = b.name
  if (a.name !== b.name) out.push(`${a.name} renamed ${b.name}`)
  if (a.type !== b.type) out.push(`${nm}: type ${a.type} → ${b.type}`)
  if ((a.kind || '') !== (b.kind || '')) out.push(`${nm}: kind ${a.kind || 'none'} → ${b.kind || 'none'}`)
  if ((a.speed ?? null) !== (b.speed ?? null)) out.push(`${nm}: Speed ${a.speed ?? 'none'} → ${b.speed ?? 'none'}`)
  for (const [f, label] of [['build', 'Build'], ['chip', 'Chip'], ['cooldown', 'Cooldown']]) {
    if ((a[f] ?? (f === 'cooldown' ? 1 : 0)) !== (b[f] ?? (f === 'cooldown' ? 1 : 0))) out.push(`${nm}: ${label} ${a[f] ?? (f === 'cooldown' ? 1 : 0)} → ${b[f] ?? (f === 'cooldown' ? 1 : 0)}`)
  }
  if (!!a.flowCard !== !!b.flowCard) out.push(`${nm}: ${b.flowCard ? 'now' : 'no longer'} a Flow card`)
  for (const k of KEYWORDS) {
    const x = keyText(a, k), y = keyText(b, k)
    if (x === y) continue
    if (!x) out.push(`${nm}: added "${y}"`)
    else if (!y) out.push(`${nm}: removed "${x}"`)
    else out.push(`${nm}: "${x}" → "${y}"`)
  }
  if ((a.art || '') !== (b.art || '')) out.push(`${nm}: card art ${b.art ? 'set' : 'removed'}`)
  return out
}
export function diffFighter(a, b) {
  const out = []
  if (a.name !== b.name) out.push(`Name ${a.name} → ${b.name}`)
  if (a.hp !== b.hp) out.push(`Base HP ${a.hp} → ${b.hp}`)
  if ((a.rules ?? 11) !== (b.rules ?? 11)) out.push(`Rules v${a.rules ?? 11} → v${b.rules ?? 11}`)
  if (!same(a.passive ?? null, b.passive ?? null)) out.push('Passive changed')
  if ((a.ai?.ownGreyValue ?? null) !== (b.ai?.ownGreyValue ?? null)) out.push(`Partner's value for its own grey ${a.ai?.ownGreyValue ?? 'default'} → ${b.ai?.ownGreyValue ?? 'default'}`)
  const n = Math.max(a.cards.length, b.cards.length)
  for (let i = 0; i < n; i++) {
    if (!a.cards[i]) out.push(`Added card ${b.cards[i].name}`)
    else if (!b.cards[i]) out.push(`Removed card ${a.cards[i].name}`)
    else out.push(...diffCard(a.cards[i], b.cards[i]))
  }
  if (a.super && b.super) out.push(...diffCard(a.super, b.super))
  else if (b.super) out.push(`Added Super ${b.super.name}`)
  else if (a.super) out.push(`Removed Super ${a.super.name}`)
  return out
}
