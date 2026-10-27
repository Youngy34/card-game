// Play: pick fighters and a mode, then play the match.

import { html, cx, useState, useEffect, useRef } from './lib.js'
import { AnyFace, CardFace, UniversalFace, CardBack } from './card.js'
import { Hud, Seg, StatusChip } from './ui.js'
import { roster, settings, saveGame, newId } from './store.js'
import * as M from './match.js'
import { describe, deltaLine } from './narrate.js'
import { player } from '../engine/engine.js'
import { UNIVERSAL } from '../engine/rules.js'
import { LEVELS } from '../engine/ai.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const WHO = {
  ai: ['You', 'Sparring partner'],
  hotseat: ['Player 1', 'Player 2'],
  watch: ['Sparring partner 1', 'Sparring partner 2'],
}

export function experimentsOn(rules) {
  const on = []
  if (rules.clock) on.push(`round timer of ${rules.clock} reveals`)
  if (rules.counterCheck === 'reveal') on.push("counters check the initiative as it stood at the reveal")
  const gd = rules.guardDamage ?? (rules.blockGrey > 0 ? 'flat' : 'off')
  if (gd === 'card') on.push('guard damage per card')
  else if (gd === 'flat') on.push(`guard damage ${rules.blockGrey} on every strike`)
  if (rules.throwCashes) on.push('throws cash the pile')
  if (rules.evadeCooldown) on.push('Duck and Step cool down')
  if (rules.waitPasses) on.push('two defences pass the initiative')
  if (rules.wrongBreakLocks) on.push('a wrong-strength break is locked')
  return on
}

export function Setup({ onStart, prefs, setPrefs }) {
  const list = roster()
  const ids = list.map(r => r.id)
  const pick = (k, id) => setPrefs({ ...prefs, sides: prefs.sides.map((s, i) => (i === k ? id : s)) })
  const sides = prefs.sides.map((id, k) => (ids.includes(id) ? id : ids[k % ids.length]))
  const s = settings()
  const difficulty = LEVELS[prefs.difficulty] ? prefs.difficulty : 'hard'
  const exp = experimentsOn(s.rules)
  const start = () => {
    const rs = sides.map(id => list.find(r => r.id === id))
    const levels = prefs.mode === 'ai' ? ['hard', difficulty] : ['hard', 'hard']
    onStart(M.startMatch({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: prefs.mode, settings: s, levels, id: newId('g') }))
  }
  return html`<div class="setup">
    <div class="stack">
      <h1>Fight night</h1>
      <p class="lede">Rules v13: Horizontal, Vertical and Throw against Guard, Duck and Step, with the initiative deciding clashes. A clean hit starts a combo: linkers build grey, enders cash it, and the defender tries to break. Both move lists are open; only the card you pick is hidden until the reveal.</p>
    </div>
    <div class="stack">
      <span class="label">Mode</span>
      <${Seg} value=${prefs.mode} options=${MODES} onChange=${mode => setPrefs({ ...prefs, mode })} label="Mode" />
      <p class="small muted">${{
        ai: "The sparring partner looks one neutral reveal ahead, plays out any counter and combo that reveal starts, and plays the mix you can't exploit.",
        hotseat: 'Each player picks in turn; the screen hides the first pick while the device changes hands. Counters are chosen in the open.',
        watch: 'Step through a game between two sparring partners.',
      }[prefs.mode]}</p>
    </div>
    ${prefs.mode === 'ai' ? html`<div class="stack">
      <span class="label">Difficulty</span>
      <${Seg} value=${difficulty} options=${Object.entries(LEVELS).map(([k, l]) => [k, l.label])} onChange=${d => setPrefs({ ...prefs, difficulty: d })} label="Difficulty" />
      <p class="small muted">${LEVELS[difficulty].about} Not yet calibrated for v13.</p>
    </div>` : null}
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${WHO[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${WHO[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP${r.fighter.epithet ? ` · ${r.fighter.epithet}` : ''} · ${r.fighter.cards.length} cards</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input id="odds" type="checkbox" checked=${prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the unexploitable mix after each reveal</label>
      <p class="small muted">Initiative +${s.rules.initiativeBonus} · combo cap ${s.rules.comboCap} · first initiative ${{ random: 'at random', a: `to ${WHO[prefs.mode][0].toLowerCase()}`, b: `to ${WHO[prefs.mode][1].toLowerCase()}` }[s.rules.firstInitiative]}${exp.length ? html` · <span class="exp">Experiments on: ${exp.join('; ')}</span>` : ' · rules as written'}. Change them in Settings.</p>
      <div class="actions"><button class="btn" onClick=${start}>Start the match</button></div>
    </div>
  </div>`
}

export function Table({ m, setM, prefs, onEnd }) {
  const names = m.f.map(f => f.name)
  const who = WHO[m.mode].map((w, k) => (!m.humans[k] && m.mode === 'ai' && m.levels?.[k] ? `${w} · ${LEVELS[m.levels[k]].label}` : w))
  // the selection belongs to one pick: a new reveal, picker or phase clears it
  const turn = `${m.id}|${m.history.length}|${m.picker}|${m.phase}`
  const [picked, setPicked] = useState(null)
  const sel = picked && picked.turn === turn ? picked.id : null
  const setSel = id => setPicked({ turn, id })
  const [saveState, setSaveState] = useState(null)
  const [auto, setAuto] = useState(false)
  const savedFor = useRef(null)
  const G = m.G


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
    const t = setTimeout(() => setM(mm => (mm.phase === 'reveal' ? M.nextReveal(mm) : M.resolveReveal(mm))), 1100)
    return () => clearTimeout(t)
  }, [auto, m.phase, m.history.length, m.mode])

  const picking = m.phase === 'pick' && m.picker !== null
  const P = m.picker
  const lockIn = () => { if (sel !== null) setM(M.lockIn(m, P, sel)) }

  return html`<div class="table">
    <div class="board">
      <${PhaseBar} m=${m} names=${names} />
      <${Hud} G=${G} side=${1} who=${who[1]} />
      <${Clash} m=${m} names=${names} prefs=${prefs} sel=${sel} />
      <${Hud} G=${G} side=${0} who=${who[0]} />
      <section class="hand-wrap" aria-label="Your move">
        ${picking ? html`
          <div class="spread">
            <h3>${m.mode === 'ai' ? 'Your pick' : `${who[P]}'s pick`} · ${G.mode === 'combo' ? (G.combo.att === P ? 'attacking' : 'defending the combo') : 'neutral'}</h3>
            <div class="actions"><button class="btn" disabled=${sel === null} onClick=${lockIn}>Lock in</button></div>
          </div>
          <${Hand} m=${m} side=${P} sel=${sel} setSel=${setSel} />` : null}
        ${m.phase === 'counter' ? html`<${CounterPick} m=${m} setM=${setM} who=${who} names=${names} />` : null}
        ${m.phase === 'reveal' ? html`<div class="actions">
          <button class="btn" onClick=${() => setM(M.nextReveal(m))}>Next reveal</button>
          ${m.mode === 'watch' ? html`<label class="check"><input id="auto" type="checkbox" checked=${auto} onChange=${e => setAuto(e.target.checked)} /> Play on automatically</label>` : null}
        </div>` : null}
        ${m.phase === 'pick' && m.mode === 'watch' ? html`<div class="actions">
          <button class="btn" onClick=${() => setM(M.resolveReveal(m))}>Reveal</button>
          <label class="check"><input id="auto" type="checkbox" checked=${auto} onChange=${e => setAuto(e.target.checked)} /> Play on automatically</label>
        </div>` : null}
        ${m.phase === 'over' ? html`<div class="spread">
          <div class="actions">
            <button class="btn" onClick=${() => onEnd('rematch')}>Rematch</button>
            <button class="btn ghost" onClick=${() => onEnd('new')}>New match</button>
          </div>
          <span class="small muted">${!m.humans.some(Boolean) ? "Sparring-partner games aren't logged. Use the Lab for those." :
            saveState === 'saved' ? 'Saved to the playtest log.' : saveState === 'saving' ? 'Saving to the playtest log…' :
            saveState ? `Couldn't save to the log (${saveState.slice(7)}).` : ''}</span>
        </div>` : null}
      </section>
    </div>
    <aside class="side">
      <${RevealLog} m=${m} />
      <${Reference} rules=${G.R} />
      <${MoveList} m=${m} side=${1} title=${`${names[1]}'s move list`} />
      <${MoveList} m=${m} side=${0} title=${`${names[0]}'s move list`} />
      <div class="actions"><button class="link" onClick=${() => onEnd('quit')}>Leave this match</button></div>
    </aside>
    ${m.phase === 'pass' ? html`<div class="overlay" role="dialog" aria-label="Pass the device">
      <div class="overlay-box">
        <span class="label">Reveal ${G.n}</span>
        <h2>${who[1 - m.picker]} has locked in</h2>
        <p class="lede">Pass the device to ${who[m.picker]}. Their pick stays hidden until the reveal.</p>
        <button class="btn" onClick=${() => setM(M.continueAfterPass(m))}>I'm ${who[m.picker]}</button>
      </div>
    </div>` : null}
  </div>`
}

function PhaseBar({ m, names }) {
  const G = m.G, R = G.R
  const clock = R.clock ? html`<span class="phase-clock">Time ${Math.max(R.clock - G.n + 1, 0)}</span>` : null
  if (m.phase === 'over') return html`<div class="phasebar"><span class="phase-tag">Game over</span><span>${m.history.length} reveals</span>${clock}</div>`
  if (G.mode === 'combo') {
    const c = G.combo, k = c.att, d = 1 - k
    return html`<div class="phasebar combo">
      <span class="phase-tag">Combo · beat ${c.beat + 1}</span>
      <span><b>${names[k]}</b> attacking · ${c.links} of ${R.comboCap} linkers and feints · ${names[d]}'s pile <b class="num">${player(G, d).pile}</b>${c.landed ? '' : ' · no linker yet, so no ender'}</span>
      ${clock}
    </div>`
  }
  return html`<div class="phasebar">
    <span class="phase-tag">Neutral · reveal ${G.n}</span>
    <span><b>${names[G.init]}</b> holds the initiative: +${R.initiativeBonus} Speed in clashes and wins ties</span>
    ${clock}
  </div>`
}

function Hand({ m, side, sel, setSel }) {
  const G = m.G, X = player(G, side), holds = G.init === side
  return html`<div class="hand">
    ${M.handView(m, side).map(v => {
      const note = v.attack && v.ok && G.mode === 'neutral' ? `Clashes at ${v.card.speed + (holds ? G.R.initiativeBonus : 0)}` : null
      return html`<div key=${String(v.id)}>
        <${AnyFace} v=${v} as="button" cls=${cx(!v.ok && 'off', sel === v.id && 'selected')} why=${v.why} note=${note} disabled=${!v.ok} guard=${G.R.guardDamage === 'card'}
          onClick=${() => v.ok && setSel(v.id)} />
      </div>`
    })}
  </div>`
}

function CounterPick({ m, setM, who, names }) {
  const p = m.pending, d = p.side, k = 1 - d
  const [sel, setSel] = useState(null)
  const exposed = player(m.G, k).f.cards[m.picks[k]]
  return html`<div class="stack">
    <div class="spread">
      <h3>${m.mode === 'ai' ? 'Counter?' : `${who[d]}: counter?`}</h3>
      <div class="actions">
        <button class="btn" disabled=${sel === null} onClick=${() => setM(M.chooseCounter(m, sel))}>Counter</button>
        <button class="btn ghost" onClick=${() => setM(M.chooseCounter(m, null))}>Don't counter</button>
      </div>
    </div>
    <p class="small muted">${names[k]}'s ${exposed.name} (Speed ${exposed.speed}) is exposed and ${names[d]} has the initiative. Any attack at Speed ${Math.max(exposed.speed - m.G.R.initiativeBonus, 0)} or more counters it, unopposed: a strike starts a combo, a throw throws.</p>
    <div class="hand">
      ${M.counterView(m).map(v => html`<div key=${v.id}>
        <${CardFace} card=${v.card} as="button" cls=${cx(!v.ok && 'off', sel === v.id && 'selected')} why=${v.why} disabled=${!v.ok} guard=${m.G.R.guardDamage === 'card'}
          onClick=${() => v.ok && setSel(v.id)} />
      </div>`)}
    </div>
  </div>`
}

// what a revealed pick looks like
function faceFor(G, side, pick, extra = {}) {
  if (typeof pick === 'number') return html`<${CardFace} card=${player(G, side).f.cards[pick].src} guard=${G.R.guardDamage === 'card'} ...${extra} />`
  const role = pick === 'G' && G.mode === 'combo' ? (G.combo.att === side ? 'feint' : 'hold') : null
  return html`<${UniversalFace} card=${UNIVERSAL[pick]} role=${role} ...${extra} />`
}

const STAMP = { hit: 'Hit', thrown: 'Thrown', blocked: 'Blocked', evaded: 'Evaded', exposed: 'Exposed', lands: 'Lands', broken: 'Broken', cashed: 'Cashed', dropped: 'Dropped' }

function Clash({ m, names, prefs, sel }) {
  const shown = m.phase === 'reveal' || m.phase === 'over'
  if (m.phase === 'counter') {
    const G = m.G, k = 1 - m.pending.side
    return html`<section class="clash" aria-label="The reveal">
      <div class="clash-cards">
        ${faceFor(G, 1, m.picks[1], { cls: k === 1 ? 'beaten' : '', stamp: k === 1 ? 'Exposed' : null })}
        <span class="vs">VS</span>
        ${faceFor(G, 0, m.picks[0], { cls: k === 0 ? 'beaten' : '', stamp: k === 0 ? 'Exposed' : null })}
      </div>
      <div class="outcome"><b>Exposed</b><span>${names[1 - k]} takes the initiative and may counter.</span></div>
    </section>`
  }
  if (!shown) {
    const ready = [m.picks[0] !== null || (m.picker === 0 && sel !== null), m.picks[1] !== null || (m.picker === 1 && sel !== null)]
    return html`<section class="clash" aria-label="The reveal">
      <div class="clash-cards">
        ${ready[1] ? html`<${CardBack} label=${`${names[1]} has picked`} />` : html`<div class="card card-back waiting"><span>?</span></div>`}
        <span class="vs">VS</span>
        ${ready[0] ? html`<${CardBack} label=${`${names[0]} has picked`} />` : html`<div class="card card-back waiting"><span>?</span></div>`}
      </div>
      <p class="small muted">${m.mode === 'ai' ? 'The sparring partner has picked.' : 'Both cards reveal together.'}</p>
    </section>`
  }
  const L = m.last, G0 = L.G0, ev = L.ev
  const D = describe(G0, ev, L.N, names)
  const over = m.phase === 'over'
  const res = m.result
  // stamps: on the attack that produced the result; Beaten on a clash loser; Read on a Break that broke
  const stamps = [null, null], cls = ['', '']
  if (ev.phase === 'neutral') {
    if (ev.kind === 'clash') { stamps[1 - ev.by] = 'Beaten'; cls[1 - ev.by] = 'beaten'; cls[ev.by] = 'won'; stamps[ev.by] = STAMP[ev.result] }
    else if (ev.kind === 'attack') stamps[ev.by] = STAMP[ev.result]
  } else {
    const k = ev.att, d = 1 - k
    stamps[k] = ev.result === 'locked' ? 'Feint' : STAMP[ev.result]
    if (ev.result === 'broken') { stamps[d] = 'Read'; cls[d] = 'won'; cls[k] = 'beaten' }
    if (ev.result === 'locked') { stamps[d] = 'Locked'; cls[d] = 'beaten' }
  }
  const ct = ev.counter && ev.counter.card !== null ? ev.counter : null
  return html`<section class="clash" aria-label="The reveal" aria-live="polite">
    ${over ? html`<div class="outcome">
      <span class="ko">${res === 0.5 ? 'Draw' : ev.timeout ? 'Time' : 'K.O.'}</span>
      <b>${res === 0.5 ? (ev.limit ? 'Reveal limit reached' : 'Level on HP') : `${names[res === 1 ? 0 : 1]} wins`}</b>
      <span>After ${m.history.length} reveals.</span>
    </div>` : null}
    <div class="clash-cards">
      ${faceFor(G0, 1, ev.picks[1], { cls: cls[1], stamp: stamps[1] })}
      <span class="vs">VS</span>
      ${faceFor(G0, 0, ev.picks[0], { cls: cls[0], stamp: stamps[0] })}
      ${ct ? html`<span class="vs">→</span>${faceFor(G0, ct.side, ct.card, { cls: 'won', stamp: 'Counter' })}` : null}
    </div>
    <div class="outcome"><b>${D.title}</b><span>${D.sub}</span></div>
    ${D.lines.length ? html`<div class="narr-lines">${D.lines.map(l => html`<p>${l}</p>`)}</div>` : null}
    <div class="narr">
      ${[1, 0].map(k => html`<div><b>${names[k]}</b><span class="muted">${deltaLine(player(G0, k), player(L.N, k))}</span></div>`)}
    </div>
    ${prefs.odds ? html`<${Mixes} entry=${m.history[m.history.length - 1]} names=${names} levels=${m.levels} />` : null}
  </section>`
}

function Mixes({ entry, names, levels }) {
  const row = (mix, label) => {
    const vis = mix.filter(([, p]) => p >= 0.01).sort((a, b) => b[1] - a[1])
    return html`<div class="stack" style=${{ gap: '4px' }}>
      <span class="small">${label}: ${vis.map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(', ')}</span>
      <div class="mixbar">${vis.map(([n, p, d]) => html`<span data-d=${d?.length === 1 ? d : d?.startsWith('B') ? 'B' : 'D'} style=${{ width: `${p * 100}%` }} title=${`${n} ${Math.round(p * 100)}%`}>${p > 0.12 ? n : ''}</span>`)}</div>
    </div>`
  }
  return html`<div class="mix">
    <span class="label">The unexploitable mix this reveal</span>
    ${row(entry.mix.b, names[1])}
    ${row(entry.mix.a, names[0])}
    ${entry.mix.playedB ? row(entry.mix.playedB, `${names[1]} actually played from (${LEVELS[levels[1]].label})`) : null}
    ${entry.mix.playedA ? row(entry.mix.playedA, `${names[0]} actually played from (${LEVELS[levels[0]].label})`) : null}
  </div>`
}

const RESULT_WORD = { none: 'Both defend', hit: 'Hit', thrown: 'Thrown', blocked: 'Blocked', evaded: 'Evaded', exposed: 'Exposed', lands: 'Lands', broken: 'Broken', locked: 'Feint', dropped: 'Dropped', cashed: 'Cashed' }

function RevealLog({ m }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Reveals</h3><p class="small muted">Each reveal's cards and the board after it appear here.</p></div>`
  return html`<div class="panel stack">
    <h3>Reveals</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class=${cx('log-row', r.phase === 'C' && 'in-combo')} key=${r.n}>
        <b>${r.n}</b>
        <div>
          <div class="vsline"><span class="tdot" data-d=${dcode(r.play[0])}></span>${r.cards[0]} <span class="muted">vs</span> <span class="tdot" data-d=${dcode(r.play[1])}></span>${r.cards[1]}
            <span class="log-res">${RESULT_WORD[r.result] || r.result}${r.counter?.card ? ` · counter ${r.counter.card}` : ''}${r.blowout ? ' · blowout' : ''}</span></div>
          <div class="small muted num">${m.f[0].name} ${r.after[0].hp} HP · ${r.after[0].pile} grey — ${m.f[1].name} ${r.after[1].hp} HP · ${r.after[1].pile} grey</div>
        </div>
      </div>`)}
    </div>
  </div>`
}

export const dcode = p => (p === 'H' || p === 'V' || p === 'T' ? p : String(p).startsWith('B') ? 'B' : 'D')

function MoveList({ m, side, title }) {
  const [open, setOpen] = useState(false)
  const X = player(m.G, side)
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>${title}</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '6px' }}>
      ${X.f.cards.map(c => {
        const cd = (X.cd1 >> c.i) & 1 ? 'Back after next reveal' : (X.cd2 >> c.i) & 1 ? 'Back in 2 reveals' : 'In hand'
        return html`<div class="spread small">
          <span class="row" style=${{ gap: '8px' }}><span class="tdot" data-d=${c.dir}></span>${c.name} <span class="muted num">${c.speed} spd · ${c.hit} hit${c.link ? ` · ${c.link} link` : c.ender ? ' · ender' : ''}</span></span>
          <span class="muted">${cd}</span>
        </div>`
      })}
    </div>` : null}
  </details>`
}

function Reference({ rules }) {
  const [open, setOpen] = useState(false)
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>Quick reference</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '12px' }}>
      <div class="tbl-wrap"><table class="tbl ref">
        <thead><tr><th>Attack</th><th>Guard</th><th>Duck</th><th>Step</th></tr></thead>
        <tbody>
          <tr><th><span class="tdot" data-d="H"></span> Horizontal</th><td>Blocked</td><td class="good">Exposed</td><td class="bad">Hit</td></tr>
          <tr><th><span class="tdot" data-d="V"></span> Vertical</th><td>Blocked</td><td class="bad">Hit</td><td class="good">Exposed</td></tr>
          <tr><th><span class="tdot" data-d="T"></span> Throw</th><td class="bad">Thrown</td><td class="good">Exposed</td><td>Evaded</td></tr>
        </tbody>
      </table></div>
      <p class="small muted">Two attacks clash on Speed; the initiative holder adds +${rules.initiativeBonus} and wins ties. After Exposed, the defender takes the initiative and may counter with any attack that would win that clash. Blocked: + the striker takes the initiative, = it stays, − the blocker takes it.${experimentsOn(rules).length ? html` <span class="exp">Experiments on: ${experimentsOn(rules).join('; ')}.</span>` : ''}</p>
      <div class="tbl-wrap"><table class="tbl ref">
        <thead><tr><th>Attacker</th><th>Defender</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>Linker</td><td>Hold, or the wrong Break</td><td>Lands: its grey goes on the pile</td></tr>
          <tr><td>Linker</td><td>Break of its strength</td><td>Broken: pile clears, defender takes the initiative</td></tr>
          <tr><td>Feint</td><td>Any Break</td><td>That Break is locked for a beat</td></tr>
          <tr><td>Feint</td><td>Hold</td><td>Dropped: grey stays, defender takes the initiative</td></tr>
          <tr><td>Ender</td><td>Anything</td><td>Cash the whole pile as damage</td></tr>
        </tbody>
      </table></div>
      <p class="small muted">At most ${rules.comboCap} linkers and feints per combo, then an ender. An ender needs a linker to have landed. No legal card: the combo blows out.</p>
    </div>` : null}
  </details>`
}
