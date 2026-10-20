// The app's data: the signed-off fighters bundled with the page, plus whatever
// has been saved since — card edits, variants, match settings and the
// playtest log.
//
// Saved data lives in the artifact's database when the page runs on claude.ai
// (shared across devices, and readable by Claude), or in this browser's
// localStorage otherwise (local development).
//
// Database layout:
//   fighters/<id>    { fighter, updatedAt }   an edited or variant fighter
//   settings/match   { rules, ai, updatedAt }
//   games/<id>       one logged game (see match.js, gameRecord)

import { validateFighter, fighterHash } from '../engine/fighters.js'
import { DEFAULT_WEIGHTS } from '../engine/ai.js'

const listeners = new Set()
let S = {
  bundled: {}, order: [], defaults: null,
  docs: {}, settings: null, games: [], gamesLoaded: false,
  backend: 'connecting',            // 'connecting' | 'db' | 'local' | 'none'
  canEdit: null, canWrite: null,
  error: null,
}
let db = null

export const getState = () => S
export const subscribe = f => { listeners.add(f); return () => listeners.delete(f) }
function set(patch) { S = { ...S, ...patch }; listeners.forEach(f => f()) }

// ---- boot ----------------------------------------------------------------
export function initData(data) {
  set({ bundled: data.fighters, order: data.order, defaults: data.settings, settings: null })
}

const LS = {
  get(k, d) { try { const v = localStorage.getItem('yomi.' + k); return v ? JSON.parse(v) : d } catch { return d } },
  put(k, v) { try { localStorage.setItem('yomi.' + k, JSON.stringify(v)); return true } catch { return false } },
}

export async function connect() {
  const c = globalThis.claude
  let database = null, user = null
  if (c?.use) {
    try { [database, user] = await Promise.all([c.use('db'), c.use('user')]) } catch { /* design for absence */ }
  }
  if (user) {
    try {
      const [canEdit, canWrite] = await Promise.all([user.canEdit(), user.can('data.write')])
      set({ canEdit, canWrite })
    } catch { /* reads never reject, but be safe */ }
  }
  if (database) {
    db = database
    set({ backend: 'db' })
    db.collection('fighters').onSnapshot(snap => {
      const docs = {}
      for (const d of snap.docs) docs[d.id] = d.data()
      set({ docs })
    }, e => set({ error: `Saved fighters stopped updating (${e.code}). Reload the page.` }))
    db.doc('settings/match').onSnapshot(snap => {
      set({ settings: snap.exists ? snap.data() : null })
    }, () => {})
    db.collection('games').orderBy('finishedAt', 'desc').limit(1000).onSnapshot(snap => {
      set({ games: snap.docs.map(d => d.data()).filter(isGame), gamesLoaded: true })
    }, e => set({ error: `The playtest log stopped updating (${e.code}). Reload the page.`, gamesLoaded: true }))
    return
  }
  set({
    backend: 'local',
    docs: LS.get('fighters', {}), settings: LS.get('settings', null),
    games: LS.get('games', []).filter(isGame), gamesLoaded: true,
  })
}

const isGame = g => g && Array.isArray(g.rounds) && Array.isArray(g.fighters) && g.fighters.length === 2 && g.rounds.length > 0

// ---- reads ---------------------------------------------------------------
export function settings() {
  const d = S.defaults || { rules: {}, ai: {} }
  const s = S.settings || {}
  return {
    rules: { counterChip: 'always', maxRounds: 60, ...d.rules, ...(s.rules || {}) },
    ai: { ...DEFAULT_WEIGHTS, ...d.ai, ...(s.ai || {}) },
  }
}

// Every fighter the app knows: the signed-off ones (edited or not), then variants.
export function roster() {
  const out = []
  const entry = (id, saved, base) => {
    let fighter = base, problems = null
    if (saved !== undefined) {
      const v = validateFighter(saved)
      if (v.errors.length) problems = v.errors
      else fighter = saved
    }
    if (!fighter) return null                    // a broken variant: leave it out
    const hash = fighterHash(fighter)
    const baseHash = base ? fighterHash(base) : null
    const status = !base ? 'variant' : hash === baseHash ? 'signed-off' : 'edited'
    return { id, fighter, base, saved: saved !== undefined, status, hash, baseHash, problems }
  }
  for (const id of S.order) out.push(entry(id, S.docs[id]?.fighter, S.bundled[id]))
  const variants = Object.keys(S.docs).filter(id => !S.bundled[id]).sort()
  for (const id of variants) out.push(entry(id, S.docs[id]?.fighter, null))
  return out.filter(Boolean)
}

export const findFighter = id => roster().find(r => r.id === id)

// ---- writes ----------------------------------------------------------------
function writable() {
  if (S.backend === 'db' || S.backend === 'local') return true
  throw new Error('Still connecting to saved data. Try again in a moment.')
}

export async function saveFighter(f) {
  writable()
  const v = validateFighter(f)
  if (v.errors.length) throw new Error(`Fix ${v.errors.length} problem${v.errors.length > 1 ? 's' : ''} before saving.`)
  const body = { fighter: JSON.parse(JSON.stringify(f)), updatedAt: Date.now() }
  if (S.backend === 'db') await db.doc(`fighters/${f.id}`).set(body)
  else {
    const docs = { ...S.docs, [f.id]: body }
    if (!LS.put('fighters', docs)) throw new Error("This browser wouldn't save it.")
    set({ docs })
  }
}

// Reset a signed-off fighter, or delete a variant
export async function removeFighter(id) {
  writable()
  if (S.backend === 'db') await db.doc(`fighters/${id}`).delete()
  else {
    const docs = { ...S.docs }; delete docs[id]
    LS.put('fighters', docs); set({ docs })
  }
}

export async function saveSettings(s) {
  writable()
  const body = { rules: s.rules, ai: s.ai, updatedAt: Date.now() }
  if (S.backend === 'db') await db.doc('settings/match').set(body)
  else { LS.put('settings', body); set({ settings: body }) }
}

export async function resetSettings() {
  writable()
  if (S.backend === 'db') await db.doc('settings/match').delete()
  else { try { localStorage.removeItem('yomi.settings') } catch {} set({ settings: null }) }
}

export async function saveGame(rec) {
  writable()
  if (S.backend === 'db') await db.collection('games').doc(rec.id).set(rec)
  else {
    const games = [rec, ...S.games].slice(0, 300)
    LS.put('games', games); set({ games })
  }
}

export async function deleteGame(id) {
  writable()
  if (S.backend === 'db') await db.doc(`games/${id}`).delete()
  else {
    const games = S.games.filter(g => g.id !== id)
    LS.put('games', games); set({ games })
  }
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export async function download(filename, text) {
  const d = await globalThis.claude?.use?.('downloads').catch(() => null)
  if (!d) throw new Error('Downloads aren\'t available here. Use Copy instead.')
  await d.save({ filename, data: text })
}
