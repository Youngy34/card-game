// Play: pick fighters and a mode, then play the match.

import { html, cx, useState, useEffect, useRef } from './lib.js'
import { CardFace, CardBack } from './card.js'
import { Hud, Seg, StatusChip } from './ui.js'
import { roster, settings, saveGame, newId } from './store.js'
import * as M from './match.js'
import { describe, deltaLine } from './narrate.js'
import { player } from '../engine/engine.js'
import { CODES, TYPE_LABEL, WHEELS, beats, beatsList, losesTo, DEFAULT_RULES } from '../engine/rules.js'
import { LEVELS, depthOf } from '../engine/ai.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const WHO = {
  ai: ['You', 'Sparring partner'],
  hotseat: ['Player 1', 'Player 2'],
  watch: ['Sparring partner 1', 'Sparring partner 2'],
}
const both = codes => codes.map(t => TYPE_LABEL[t]).join(' and ')

export function experimentsOn(rules) {
  const R = { ...DEFAULT_RULES, ...rules }
  const on = []
  if (R.wheel === 'first') on.push('the first-draft wheel (a blocked Focus doubles its pile)')
  if (R.wheel === 'alt') on.push('the alternative wheel (Heavy and Grab swapped; a blocked Focus fizzles)')
  if (R.mirrors === 'all') on.push('mirrors take effect')
  if (R.mirrors === 'focus') on.push('Focus mirrors take effect')
  if (R.blockedHeavyGrey) on.push(`a blocked Heavy puts ${R.blockedHeavyGrey} grey on its owner`)
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
      <p class="lede">Rules v14: five types, each beating two and losing to two. Strike, Heavy, Grab, Focus and Block, with one card of each. Strikes build grey, Heavies and Grabs cash it, Focus clears your own, and Block turns a Strike's grey back. Both move lists are open; only the card you pick is hidden until the reveal.</p>
    </div>
    <${Wheel} rules=${s.rules} />
    <div class="stack">
      <span class="label">Mode</span>
      <${Seg} value=${prefs.mode} options=${MODES} onChange=${mode => setPrefs({ ...prefs, mode })} label="Mode" />
      <p class="small muted">${{
        ai: `The sparring partner looks ${depthOf(s.ai) === 1 ? 'one reveal' : `${depthOf(s.ai)} reveals`} ahead, so it sees what comes back off cooldown, and plays the mix you can't exploit.`,
        hotseat: 'Each player picks in turn; the screen hides the first pick while the device changes hands.',
        watch: 'Step through a game between two sparring partners.',
      }[prefs.mode]}</p>
    </div>
    ${prefs.mode === 'ai' ? html`<div class="stack">
      <span class="label">Difficulty</span>
      <${Seg} value=${difficulty} options=${Object.entries(LEVELS).map(([k, l]) => [k, l.label])} onChange=${d => setPrefs({ ...prefs, difficulty: d })} label="Difficulty" />
      <p class="small muted">${LEVELS[difficulty].about} Not yet calibrated for v14.</p>
    </div>` : null}
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${WHO[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${WHO[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP${r.fighter.epithet ? ` · ${r.fighter.epithet}` : ''}${r.fighter.cards.length !== 5 ? ` · ${r.fighter.cards.length} cards` : ''}</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input id="hints" type="checkbox" checked=${prefs.hints} onChange=${e => setPrefs({ ...prefs, hints: e.target.checked })} /> Show reading hints while you pick: what the cooldowns and piles mean</label>
      <label class="check"><input id="odds" type="checkbox" checked=${prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the unexploitable mix after each reveal</label>
      <p class="small muted">${exp.length ? html`<span class="exp">Experiments on: ${exp.join('; ')}</span>` : 'Rules as written'}. Change them in Settings.</p>
      <div class="actions"><button class="btn" onClick=${start}>Start the match</button></div>
    </div>
  </div>`
}

// The wheel, drawn as a ring of the five types in order
export function Wheel({ rules, small = false }) {
  const R = { ...DEFAULT_RULES, ...rules }
  const order = WHEELS[R.wheel]?.order || WHEELS.v14.order
  return html`<div class=${cx('wheel', small && 'small')} role="img" aria-label=${`The wheel: ${order.map(t => TYPE_LABEL[t]).join(', ')}; each beats the next two`}>
    ${order.map((t, i) => html`<span class="wheel-step"><span class="wheel-type" data-d=${t}>${TYPE_LABEL[t]}</span>${i < 4 ? html`<span class="wheel-arrow">→</span>` : html`<span class="wheel-arrow">↺</span>`}</span>`)}
    <span class="small muted wheel-note">Each beats the next two.</span>
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
      <${PhaseBar} m=${m} />
      <${Hud} G=${G} side=${1} who=${who[1]} />
      <${Clash} m=${m} names=${names} prefs=${prefs} sel=${sel} />
      <${Hud} G=${G} side=${0} who=${who[0]} />
      <section class="hand-wrap" aria-label="Your move">
        ${picking ? html`
          <div class="spread">
            <h3>${m.mode === 'ai' ? 'Your pick' : `${who[P]}'s pick`}</h3>
            <div class="actions"><button class="btn" disabled=${sel === null} onClick=${lockIn}>Lock in</button></div>
          </div>
          ${prefs.hints ? html`<${Hints} m=${m} side=${P} names=${names} />` : null}
          <${Hand} m=${m} side=${P} sel=${sel} setSel=${setSel} />` : null}
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

function PhaseBar({ m }) {
  const G = m.G
  if (m.phase === 'over') return html`<div class="phasebar"><span class="phase-tag">Game over</span><span>${m.history.length} reveals</span></div>`
  return html`<div class="phasebar">
    <span class="phase-tag">Reveal ${G.n}</span>
    <${Wheel} rules=${G.R} small=${true} />
  </div>`
}

// What the board says, for the player picking: the opponent's missing types and the piles
function Hints({ m, side, names }) {
  const G = m.G, R = G.R, me = player(G, side), them = player(G, 1 - side), o = names[1 - side]
  const lines = []
  for (const t of M.missing(m, 1 - side)) {
    lines.push(html`<p><b>${o}'s ${TYPE_LABEL[t]} is cooling down.</b> Your ${both(beatsList(R.wheel, t))} are safe from it, and your ${both(losesTo(R.wheel, t))} have one target fewer.</p>`)
  }
  for (const t of M.missing(m, side)) {
    lines.push(html`<p class="muted">Your ${TYPE_LABEL[t]} is cooling down, so ${o}'s ${both(beatsList(R.wheel, t))} are safe from it.</p>`)
  }
  const cashers = both(CODES.filter(t => (t === 'H' || t === 'G') && beats(R.wheel, t, 'F')))
  if (them.pile >= Math.max(them.hp, 1)) lines.push(html`<p><b>${o}'s pile is lethal</b> (${them.pile} grey, ${them.hp} HP): any Heavy or Grab of yours that lands wins.</p>`)
  else if (them.pile >= 5) lines.push(html`<p><b>${o}'s pile is ${them.pile}.</b> They'd like to Focus it away; ${cashers} beat a Focus and cash it.</p>`)
  if (me.pile >= Math.max(me.hp, 1)) lines.push(html`<p><b>Your pile is lethal</b> (${me.pile} grey, ${me.hp} HP): any Heavy or Grab of theirs that lands wins.</p>`)
  else if (me.pile >= 5) lines.push(html`<p><b>Your pile is ${me.pile}.</b> Focus clears it, but loses to ${cashers}.</p>`)
  if (!lines.length) lines.push(html`<p class="muted">Nothing cooling down and no big piles: the opening is the classic triangle. Strike beats Grab, Grab beats Block, Block beats Strike.</p>`)
  return html`<div class="hints" aria-label="Reading the board">${lines}</div>`
}

function Hand({ m, side, sel, setSel }) {
  return html`<div class="hand">
    ${M.handView(m, side).map(v => html`<div key=${String(v.id)}>
      <${CardFace} card=${v.card} rules=${m.G.R} as="button" cls=${cx(!v.ok && 'off', sel === v.id && 'selected')} why=${v.why} disabled=${!v.ok}
        onClick=${() => v.ok && setSel(v.id)} />
    </div>`)}
  </div>`
}

function Clash({ m, names, prefs, sel }) {
  const shown = m.phase === 'reveal' || m.phase === 'over'
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
  const stamps = [null, null], cls = ['', '']
  if (ev.kind === 'mirror') { stamps[0] = stamps[1] = ev.result === 'cancel' ? 'Cancel' : 'Trade' }
  else { stamps[ev.by] = 'Wins'; cls[ev.by] = 'won'; cls[1 - ev.by] = 'beaten' }
  const face = k => html`<${CardFace} card=${player(G0, k).f.cards[ev.picks[k]].src} rules=${G0.R} cls=${cls[k]} stamp=${stamps[k]} />`
  return html`<section class="clash" aria-label="The reveal" aria-live="polite">
    ${over ? html`<div class="outcome">
      <span class="ko">${res === 0.5 ? 'Draw' : 'K.O.'}</span>
      <b>${res === 0.5 ? (ev.limit ? 'Reveal limit reached' : 'Double K.O., level') : `${names[res === 1 ? 0 : 1]} wins`}</b>
      <span>After ${m.history.length} reveals.</span>
    </div>` : null}
    <div class="clash-cards">${face(1)}<span class="vs">VS</span>${face(0)}</div>
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
      <div class="mixbar">${vis.map(([n, p, d]) => html`<span data-d=${d} style=${{ width: `${p * 100}%` }} title=${`${n} ${Math.round(p * 100)}%`}>${p > 0.12 ? n : ''}</span>`)}</div>
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

export const RESULT_WORD = { hit: 'Strike lands', cash: 'Cashed', clear: 'Focus clears', turnback: 'Blocked', stopped: 'Heavy blocked', double: 'Doubled', fizzle: 'Fizzled', cancel: 'Cancel', trade: 'Trade' }
export const resultWord = r => (r.kind === 'mirror' ? RESULT_WORD[r.result] : `${TYPE_LABEL[r.types[r.by]]} wins · ${RESULT_WORD[r.result] || r.result}`)

function RevealLog({ m }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Reveals</h3><p class="small muted">Each reveal's cards and the board after it appear here.</p></div>`
  return html`<div class="panel stack">
    <h3>Reveals</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class="log-row" key=${r.n}>
        <b>${r.n}</b>
        <div>
          <div class="vsline"><span class="tdot" data-d=${r.types[0]}></span>${r.cards[0]} <span class="muted">vs</span> <span class="tdot" data-d=${r.types[1]}></span>${r.cards[1]}
            <span class="log-res">${resultWord(r)}</span></div>
          <div class="small muted num">${m.f[0].name} ${r.after[0].hp} HP · ${r.after[0].pile} grey — ${m.f[1].name} ${r.after[1].hp} HP · ${r.after[1].pile} grey</div>
        </div>
      </div>`)}
    </div>
  </div>`
}

export const dcode = t => t

function MoveList({ m, side, title }) {
  const [open, setOpen] = useState(false)
  const X = player(m.G, side)
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>${title}</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '6px' }}>
      ${X.f.cards.map(c => {
        const cd = (X.cd1 >> c.i) & 1 ? 'Back after next reveal' : (X.cd2 >> c.i) & 1 ? 'Back in 2 reveals' : 'In hand'
        const nums = c.t === 'S' ? `${c.grey} grey · ${c.chip} chip` : c.t === 'H' || c.t === 'G' ? `cash · ${c.chip} chip` : ''
        return html`<div class="spread small">
          <span class="row" style=${{ gap: '8px' }}><span class="tdot" data-d=${c.t}></span>${c.name} <span class="muted num">${TYPE_LABEL[c.t]}${nums ? ` · ${nums}` : ''} · CD ${c.cd}</span></span>
          <span class="muted">${cd}</span>
        </div>`
      })}
    </div>` : null}
  </details>`
}

const CELL = { hit: 'Builds', cash: 'Cashes', clear: 'Clears', turnback: 'Turns back', stopped: 'Stops it', double: 'Doubles', fizzle: 'Fizzles' }
function cellWord(R, x, y) {
  if (x === y) return R.mirrors === 'all' || (R.mirrors === 'focus' && x === 'F') ? 'Both' : 'Cancel'
  if (!beats(R.wheel, x, y)) return null
  if (x === 'S') return CELL.hit
  if (x === 'H' || x === 'G') return CELL.cash
  if (x === 'F') return CELL.clear
  return y === 'S' ? CELL.turnback : y === 'H' ? CELL.stopped : R.wheel === 'first' ? CELL.double : CELL.fizzle
}

function Reference({ rules }) {
  const [open, setOpen] = useState(false)
  const R = { ...DEFAULT_RULES, ...rules }
  const order = WHEELS[R.wheel]?.order || WHEELS.v14.order
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>Quick reference</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '12px' }}>
      <div class="tbl-wrap"><table class="tbl ref">
        <thead><tr><th>Yours · theirs</th>${order.map(t => html`<th><span class="tdot" data-d=${t}></span> ${TYPE_LABEL[t]}</th>`)}</tr></thead>
        <tbody>${order.map(x => html`<tr><th><span class="tdot" data-d=${x}></span> ${TYPE_LABEL[x]}</th>
          ${order.map(y => { const w = cellWord(R, x, y); return html`<td class=${w && x !== y ? 'good' : x === y ? '' : 'bad'}>${w || 'Loses'}</td>` })}
        </tr>`)}</tbody>
      </table></div>
      <p class="small muted">Strike: its Grey on their pile, then its Chip. Heavy and Grab: cash their whole pile as damage, then Chip. Focus: clear your own pile. Block: a blocked Strike's Grey goes on its owner's pile; ${R.blockedHeavyGrey ? `a blocked Heavy puts ${R.blockedHeavyGrey} grey on its owner` : 'a blocked Heavy is simply stopped'}. Every card goes on cooldown when played.${experimentsOn(R).length ? html` <span class="exp">Experiments on: ${experimentsOn(R).join('; ')}.</span>` : ''}</p>
    </div>` : null}
  </details>`
}
