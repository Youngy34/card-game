// The app shell: tabs, the current match, and per-viewer preferences.

import { html, useState, useEffect, useRef, cx } from './lib.js'
import { subscribe, getState, roster } from './store.js'
import { Setup, Table } from './play.js'
import { Editor } from './editor.js'
import { Lab } from './lab.js'
import { Log } from './log.js'
import { Settings } from './settings.js'
import { Toaster } from './ui.js'
import * as M from './match.js'

const TABS = [['play', 'Play'], ['movelists', 'Move lists'], ['lab', 'Lab'], ['log', 'Playtest log'], ['rules', 'Settings']]

const local = {
  get(k, d) { try { const v = localStorage.getItem('yomi.ui.' + k); return v ? JSON.parse(v) : d } catch { return d } },
  put(k, v) { try { localStorage.setItem('yomi.ui.' + k, JSON.stringify(v)) } catch { /* fine */ } },
}

export function App({ boot = {} }) {
  const [, force] = useState(0)
  useEffect(() => {
    const off = subscribe(() => force(x => x + 1))
    force(x => x + 1)                     // catch anything that changed before we subscribed
    return off
  }, [])
  const fromHash = (globalThis.location?.hash || '').slice(1)
  const [tab, setTab] = useState(boot.tab || (TABS.some(t => t[0] === fromHash) ? fromHash : 'play'))
  const [m, setM] = useState(() => {
    if (!boot.match) return null
    try { return M.replay(boot.match) } catch { return null }
  })
  const [prefs, setPrefsRaw] = useState(() => local.get('prefs', { mode: 'ai', sides: ['gambler', 'bastion'], odds: false }))
  const setPrefs = p => { setPrefsRaw(p); local.put('prefs', p) }
  const [edSel, setEdSel] = useState(boot.edSel || null)
  const [lab, setLab] = useState({})
  const st = getState()

  // keep an unfinished match through a page update
  const now = useRef(null)
  now.current = { tab, edSel, m }
  useEffect(() => {
    globalThis.claude?.hot?.snapshot?.(() => {
      const { tab, edSel, m } = now.current
      return { tab, edSel, match: m && m.phase !== 'over' ? M.snapshot(m) : null }
    })
  }, [])

  const onEnd = what => {
    if (what === 'rematch') {
      const list = roster()
      const rs = m.json.map(j => list.find(r => r.id === j.id))
      if (rs.every(Boolean)) {
        setM(M.startMatch({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: m.mode,
                           settings: m.settingsUsed, id: `g-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}` }))
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
        <div class="brand"><b>YOMI</b><span>Playtest table · rules v11</span></div>
        <nav class="tabs" aria-label="Sections">
          ${TABS.map(([k, label]) => html`<button class="tab" aria-current=${tab === k ? 'page' : undefined} onClick=${() => setTab(k)}>${label}${k === 'play' && m && m.phase !== 'over' ? ' ·' : ''}</button>`)}
        </nav>
        <span class="conn">${conn}</span>
      </div>
    </header>
    <main class="wrap">
      ${st.error ? html`<div class="banner bad">${st.error}</div>` : null}
      ${tab === 'play' ? (m ? html`<${Table} m=${m} setM=${setM} prefs=${prefs} onEnd=${onEnd} />` : html`<${Setup} onStart=${setM} prefs=${prefs} setPrefs=${setPrefs} />`) : null}
      ${tab === 'movelists' ? html`<${Editor} selected=${edSel} setSelected=${setEdSel} />` : null}
      ${tab === 'lab' ? html`<${Lab} state=${lab} setState=${setLab} />` : null}
      ${tab === 'log' ? html`<${Log} />` : null}
      ${tab === 'rules' ? html`<${Settings} />` : null}
    </main>
    <${Toaster} />
  </div>`
}
