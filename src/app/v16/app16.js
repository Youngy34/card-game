// The v16 page's shell: tabs, the current match, and per-viewer preferences.

import { html, useState, useEffect, useRef } from '../lib.js'
import { subscribe, getState, roster } from '../store.js'
import { Setup16, Table16 } from './play16.js'
import { Decks16 } from './decks16.js'
import { Lab16 } from './lab16.js'
import { Log16 } from './log16.js'
import { Settings16 } from './settings16.js'
import { Toaster } from '../ui.js'
import * as M from './match16.js'

const TABS = [['play', 'Play'], ['decks', 'Decks'], ['lab', 'Lab'], ['log', 'Playtest log'], ['rules', 'Settings']]
const local = {
  get(k, d) { try { const v = localStorage.getItem('yomi16.ui.' + k); return v ? JSON.parse(v) : d } catch { return d } },
  put(k, v) { try { localStorage.setItem('yomi16.ui.' + k, JSON.stringify(v)) } catch { /* fine */ } },
}

export function App16({ boot = {} }) {
  const [, force] = useState(0)
  useEffect(() => { const off = subscribe(() => force(x => x + 1)); force(x => x + 1); return off }, [])
  const fromHash = (globalThis.location?.hash || '').slice(1)
  const [tab, setTab] = useState(boot.tab || (TABS.some(t => t[0] === fromHash) ? fromHash : 'play'))
  const [m, setM] = useState(() => (boot.match && boot.match.G ? boot.match : null))
  const [prefs, setPrefsRaw] = useState(() => ({ mode: 'ai', difficulty: 'hard', hints: true, odds: false, ...local.get('prefs', {}), sides: local.get('prefs', {}).sides || getState().edition?.defaultSides || ['benchmark16', 'benchmark16'] }))
  const setPrefs = p => { setPrefsRaw(p); local.put('prefs', p) }
  const [edSel, setEdSel] = useState(boot.edSel || null)
  const [lab, setLab] = useState({})
  const st = getState()

  const now = useRef(null)
  now.current = { tab, edSel, m }
  useEffect(() => {
    globalThis.claude?.hot?.snapshot?.(() => {
      const { tab, edSel, m } = now.current
      return { tab, edSel, match: m && m.phase !== 'over' ? M.snapshot16(m) : null }
    })
  }, [])

  const onEnd = what => {
    if (what === 'rematch') {
      const list = roster()
      const rs = m.json.map(j => list.find(r => r.id === j.id))
      if (rs.every(Boolean)) {
        setM(M.startMatch16({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: m.mode, levels: m.levels, settings: m.settingsUsed,
                              id: `g-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}` }))
        return
      }
    }
    setM(null)
  }

  const conn = {
    connecting: html`Connecting to saved data…`,
    db: html`<b>Saved to this page</b> · edits and the log sync across devices`,
    local: html`<b>This browser only</b> · edits and the log stay here`,
    none: html`Not saving`,
  }[st.backend]

  return html`<div>
    <header class="top">
      <div class="top-inner">
        <div class="brand"><b>YOMI</b><span>Playtest table · ${st.edition?.subtitle || 'rules v16'}</span></div>
        <nav class="tabs" aria-label="Sections">
          ${TABS.map(([k, label]) => html`<button class="tab" aria-current=${tab === k ? 'page' : undefined} onClick=${() => setTab(k)}>${label}${k === 'play' && m && m.phase !== 'over' ? ' ·' : ''}</button>`)}
        </nav>
        <span class="conn">${conn}</span>
      </div>
    </header>
    <main class="wrap">
      ${st.error ? html`<div class="banner bad">${st.error}</div>` : null}
      ${tab === 'play' ? (m ? html`<${Table16} m=${m} setM=${setM} prefs=${prefs} onEnd=${onEnd} />` : html`<${Setup16} onStart=${setM} prefs=${prefs} setPrefs=${setPrefs} />`) : null}
      ${tab === 'decks' ? html`<${Decks16} selected=${edSel} setSelected=${setEdSel} />` : null}
      ${tab === 'lab' ? html`<${Lab16} state=${lab} setState=${setLab} />` : null}
      ${tab === 'log' ? html`<${Log16} />` : null}
      ${tab === 'rules' ? html`<${Settings16} />` : null}
    </main>
    <${Toaster} />
  </div>`
}
