// v16 fighters for the app: the engine form, the hash logged with each game,
// and the settings a v16 page runs with.

import { toFighter16 } from '../../engine/v16/cards.js'
import { fighterHash } from '../../engine/fighters.js'
import { DEFAULT_RULES16 } from '../../engine/v16/engine.js'
import { DEFAULT_W16 } from '../../engine/v16/ai.js'
import { getState } from '../store.js'

export const fighterHash16 = f => fighterHash(f)

export function settings16() {
  const S = getState()
  const d = S.defaults || { rules: {}, ai: {} }
  const s = S.settings || {}
  return {
    rules: { ...DEFAULT_RULES16, ...d.rules, ...(s.rules || {}) },
    ai: { ...DEFAULT_W16, ...d.ai, ...(s.ai || {}) },
  }
}

export { toFighter16 }
