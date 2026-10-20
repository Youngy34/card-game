// Play: pick fighters and a mode, then play the match.

import { html, cx, useState, useEffect, useRef } from './lib.js'
import { CardFace, CardBack } from './card.js'
import { Hud, Seg, StatusChip, toast } from './ui.js'
import { roster, settings, saveGame, newId, getState } from './store.js'
import * as M from './match.js'
import { outcomeLine, eventLines, deltaLine } from './narrate.js'
import { card } from '../engine/engine.js'
import { TYPE_LABEL } from '../engine/keywords.js'
import { PASSIVES } from '../engine/keywords.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const WHO = {
  ai: ['You', 'Sparring partner'],
  hotseat: ['Player 1', 'Player 2'],
  watch: ['Sparring partner 1', 'Sparring partner 2'],
}

export function Setup({ onStart, prefs, setPrefs }) {
  const list = roster()
  const ids = list.map(r => r.id)
  const pick = (k, id) => setPrefs({ ...prefs, sides: prefs.sides.map((s, i) => (i === k ? id : s)) })
  const sides = prefs.sides.map((id, k) => (ids.includes(id) ? id : ids[k % ids.length]))
  const s = settings()
  const ruleNote = { always: 'whenever it resolves (the current rule)', strict: 'only when it beats a Pressure (test rule)', attack: 'only against an attack (test rule)' }[s.rules.counterChip]
  const start = () => {
    const rs = sides.map(id => list.find(r => r.id === id))
    onStart(M.startMatch({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: prefs.mode, settings: s, id: newId('g') }))
  }
  return html`<div class="setup">
    <div class="stack">
      <h1>Fight night</h1>
      <p class="lede">Pick two fighters and play a full v11 game. Both move lists are open information; only the card you choose is hidden until the reveal.</p>
    </div>
    <div class="stack">
      <span class="label">Mode</span>
      <${Seg} value=${prefs.mode} options=${MODES} onChange=${mode => setPrefs({ ...prefs, mode })} label="Mode" />
      <p class="small muted">${{
        ai: "The sparring partner is the simulator's player: each round it plays the mix you can't exploit.",
        hotseat: 'Each player picks in turn; the screen hides the first pick while the device changes hands.',
        watch: 'Step through a game between two sparring partners.',
      }[prefs.mode]}</p>
    </div>
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${WHO[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${WHO[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP${r.fighter.epithet ? ` · ${r.fighter.epithet}` : ''}${r.fighter.passive ? ` · ${Object.keys(r.fighter.passive).map(p => PASSIVES[p]?.label).join(', ')}` : ''}</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input type="checkbox" checked=${prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the unexploitable mix after each reveal</label>
      <p class="small muted">Recover chip lands ${ruleNote}. Change rules and the sparring partner's weights in Settings.</p>
      <div class="actions"><button class="btn" onClick=${start}>Start the match</button></div>
    </div>
  </div>`
}

export function Table({ m, setM, prefs, onEnd }) {
  const names = m.f.map(f => f.name)
  const who = WHO[m.mode]
  const [sel, setSel] = useState(null)
  const [saveState, setSaveState] = useState(null)
  const [auto, setAuto] = useState(false)
  const savedFor = useRef(null)
  const X = [m.A, m.B]

  useEffect(() => { setSel(null) }, [m.round, m.picker, m.phase])

  // log the finished game (only games with a person in them)
  useEffect(() => {
    if (m.phase !== 'over' || savedFor.current === m.id || !m.humans.some(Boolean)) return
    savedFor.current = m.id
    setSaveState('saving')
    saveGame(M.gameRecord(m)).then(() => setSaveState('saved'), e => setSaveState(`error: ${e.message}`))
  }, [m.phase, m.id])

  // watch mode autoplay
  useEffect(() => {
    if (m.mode !== 'watch' || !auto || m.phase === 'over') return
    const t = setTimeout(() => setM(mm => (mm.phase === 'reveal' ? M.nextRound(mm) : M.resolveRound(mm))), 1100)
    return () => clearTimeout(t)
  }, [auto, m.phase, m.round, m.mode])

  const picking = m.phase === 'pick' && m.picker !== null
  const P = picking ? m.picker : null
  const lockIn = () => { if (sel !== null) setM(M.lockIn(m, P, sel)) }

  return html`<div class="table">
    <div class="board">
      <${Hud} X=${m.B} Y=${m.A} who=${who[1]} />
      <${Clash} m=${m} names=${names} prefs=${prefs} sel=${sel} />
      <${Hud} X=${m.A} Y=${m.B} who=${who[0]} />
      <section class="hand-wrap" aria-label="Your move">
        ${picking ? html`
          <div class="spread">
            <h3>${m.mode === 'ai' ? 'Your pick' : `${who[P]}'s pick`} · Round ${m.round}</h3>
            <div class="actions">
              <button class="btn" disabled=${sel === null} onClick=${lockIn}>Lock in</button>
            </div>
          </div>
          <div class="hand">
            ${M.handView(X[P]).map(v => html`<div key=${v.i}>
              <${CardFace} as="button" card=${v.c.src} isSuper=${!!v.sup} hasFlow=${X[P].f.flow}
                cls=${cx(!v.ok && 'off', sel === v.i && 'selected')} why=${v.why} disabled=${!v.ok}
                onClick=${() => v.ok && setSel(v.i)} />
            </div>`)}
          </div>` : null}
        ${m.phase === 'reveal' ? html`<div class="actions">
          <button class="btn" onClick=${() => setM(M.nextRound(m))}>Next round</button>
          ${m.mode === 'watch' ? html`<label class="check"><input type="checkbox" checked=${auto} onChange=${e => setAuto(e.target.checked)} /> Play on automatically</label>` : null}
        </div>` : null}
        ${m.phase === 'pick' && m.mode === 'watch' ? html`<div class="actions">
          <button class="btn" onClick=${() => setM(M.resolveRound(m))}>Reveal</button>
          <label class="check"><input type="checkbox" checked=${auto} onChange=${e => setAuto(e.target.checked)} /> Play on automatically</label>
        </div>` : null}
        ${m.phase === 'over' ? html`<div class="spread">
          <div class="actions">
            <button class="btn" onClick=${() => onEnd('rematch')}>Rematch</button>
            <button class="btn ghost" onClick=${() => onEnd('new')}>New match</button>
          </div>
          <span class="small muted">${!m.humans.some(Boolean) ? 'Sparring-partner games aren\'t logged. Use the Lab for those.' :
            saveState === 'saved' ? 'Saved to the playtest log.' : saveState === 'saving' ? 'Saving to the playtest log…' :
            saveState ? `Couldn't save to the log (${saveState.slice(7)}).` : ''}</span>
        </div>` : null}
      </section>
    </div>
    <aside class="side">
      <${RoundLog} m=${m} />
      <${MoveList} X=${m.B} title=${`${names[1]}'s move list`} />
      <${MoveList} X=${m.A} title=${`${names[0]}'s move list`} />
      <div class="actions"><button class="link" onClick=${() => onEnd('quit')}>Leave this match</button></div>
    </aside>
    ${m.phase === 'pass' ? html`<div class="overlay" role="dialog" aria-label="Pass the device">
      <div class="overlay-box">
        <span class="label">Round ${m.round}</span>
        <h2>${who[1 - m.picker]} has locked in</h2>
        <p class="lede">Pass the device to ${who[m.picker]}. Their pick stays hidden until the reveal.</p>
        <button class="btn" onClick=${() => setM(M.continueAfterPass(m))}>I'm ${who[m.picker]}</button>
      </div>
    </div>` : null}
  </div>`
}

function Clash({ m, names, prefs, sel }) {
  const shown = m.phase === 'reveal' || m.phase === 'over'
  if (!shown) {
    // before the reveal: show who has locked in, face down
    const ready = [m.picks[0] !== null || (m.picker === 0 && sel !== null), m.picks[1] !== null || (m.picker === 1 && sel !== null)]
    return html`<section class="clash" aria-label="The clash">
      <div class="clash-cards">
        ${ready[1] ? html`<${CardBack} label=${`${names[1]} has picked`} />` : html`<div class="card card-back" style=${{ opacity: 0.35 }}><span>?</span></div>`}
        <span class="vs">VS</span>
        ${ready[0] ? html`<${CardBack} label=${`${names[0]} has picked`} />` : html`<div class="card card-back" style=${{ opacity: 0.35 }}><span>?</span></div>`}
      </div>
      <p class="small muted">Round ${m.round}. ${m.mode === 'ai' ? 'The sparring partner has picked.' : 'Both cards reveal together.'}</p>
    </section>`
  }
  const L = m.last
  const ca = card(L.before[0], L.a), cb = card(L.before[1], L.b)
  const o = outcomeLine(ca, cb)
  const ev = eventLines(L, names)
  const over = m.phase === 'over'
  const res = m.result
  return html`<section class="clash" aria-label="The clash" aria-live="polite">
    ${over ? html`<div class="outcome">
      <span class="ko">${res === 0.5 ? 'Draw' : 'K.O.'}</span>
      <b>${res === 0.5 ? (L.s.A.hp <= 0 ? 'Double KO, dead level' : 'Round limit reached') : `${names[res === 1 ? 0 : 1]} wins`}</b>
      <span>${L.s.A.hp <= 0 && L.s.B.hp <= 0 && res !== 0.5 ? `Double KO: ${names[res === 1 ? 0 : 1]} ends less far below 0 (${L.s.A.hp} vs ${L.s.B.hp}). ` : ''}Round ${m.round}.</span>
    </div>` : null}
    <div class="clash-cards">
      <${CardFace} card=${cb.src} isSuper=${cb.sup} hasFlow=${m.f[1].flow} cls=${cx(o.winner === 1 && 'won', ev[1].beaten && 'beaten')} stamp=${ev[1].beaten ? 'Beaten' : null} />
      <span class="vs">VS</span>
      <${CardFace} card=${ca.src} isSuper=${ca.sup} hasFlow=${m.f[0].flow} cls=${cx(o.winner === 0 && 'won', ev[0].beaten && 'beaten')} stamp=${ev[0].beaten ? 'Beaten' : null} />
    </div>
    <div class="outcome"><b>${o.title}</b><span>${o.sub}</span></div>
    <div class="narr">
      ${[1, 0].map(k => html`<div>
        <b>${names[k]}</b>
        <span>${ev[k].card} ${ev[k].text}. <em>${deltaLine(L.before[k], k === 0 ? L.s.A : L.s.B)}</em></span>
      </div>`)}
    </div>
    ${prefs.odds ? html`<${Mixes} entry=${m.history[m.history.length - 1]} names=${names} f=${m.f} />` : null}
  </section>`
}

function Mixes({ entry, names, f }) {
  const typeOf = (k, name) => [...f[k].cards, f[k].sup].find(c => c.name === name)?.t || 'T'
  return html`<div class="mix">
    <span class="label">The unexploitable mix this round</span>
    ${[[1, entry.mix.b], [0, entry.mix.a]].map(([k, mix]) => html`<div class="stack" style=${{ gap: '4px' }}>
      <span class="small">${names[k]}: ${mix.filter(([, p]) => p >= 0.01).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(', ')}</span>
      <div class="mixbar">${mix.filter(([, p]) => p >= 0.01).map(([n, p]) => html`<span data-t=${typeOf(k, n)} style=${{ width: `${p * 100}%` }} title=${`${n} ${Math.round(p * 100)}%`}>${p > 0.12 ? n : ''}</span>`)}</div>
    </div>`)}
  </div>`
}

function RoundLog({ m }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Rounds</h3><p class="small muted">Each round's cards and the board after it appear here.</p></div>`
  return html`<div class="panel stack">
    <h3>Rounds</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class="log-row" key=${r.n}>
        <b>${r.n}</b>
        <div>
          <div class="vsline"><span class="tdot" data-t=${r.types[0]}></span>${r.cards[0]} <span class="muted">vs</span> <span class="tdot" data-t=${r.types[1]}></span>${r.cards[1]}</div>
          <div class="small muted num">${m.f[0].name} ${r.after[0].hp} HP · ${r.after[0].pile} grey — ${m.f[1].name} ${r.after[1].hp} HP · ${r.after[1].pile} grey</div>
        </div>
      </div>`)}
    </div>
  </div>`
}

function MoveList({ X, title }) {
  const [open, setOpen] = useState(false)
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>${title}</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '6px' }}>
      ${M.handView(X).map(v => html`<div class="spread small">
        <span class="row" style=${{ gap: '8px' }}><span class="tdot" data-t=${v.c.t}></span>${v.c.name}${v.sup ? ' (Super)' : ''}</span>
        <span class="muted">${v.ok ? 'Can play' : v.why}</span>
      </div>`)}
    </div>` : null}
  </details>`
}
