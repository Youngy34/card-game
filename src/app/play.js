// Play: pick fighters and a mode, then play the match.

import { html, cx, useState, useEffect, useRef } from './lib.js'
import { CardFace, CardBack } from './card.js'
import { Hud, Seg, StatusChip, toast } from './ui.js'
import { roster, settings, saveGame, newId, getState } from './store.js'
import * as M from './match.js'
import { outcomeLine, eventLines, deltaLine } from './narrate.js'
import { card, tieWinner15 } from '../engine/engine.js'
import { TYPE_LABEL } from '../engine/keywords.js'
import { PASSIVES } from '../engine/keywords.js'
import { LEVELS } from '../engine/ai.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const rulesOf = f => (f.v15 ? 15 : f.v12 ? 12 : 11)
const PAYOFF = {
  any: 'a Recover that beats a Pressure earns a free follow-up attack',
  pressure: 'a Recover that beats a Pressure earns a free follow-up Pressure',
  fixed: 'a Recover that beats a Pressure deals fixed damage to the attacker',
  none: 'a Recover that beats a Pressure only clears its own pile',
}
const TIE = {
  cancel: 'speed ties cancel',
  lowhp: 'a speed tie goes to the player on less HP (on equal HP it cancels)',
}
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
  const difficulty = LEVELS[prefs.difficulty] ? prefs.difficulty : 'hard'
  const ruleNote = { always: 'whenever it resolves (the current rule)', strict: 'only when it beats a Pressure (test rule)', attack: 'only against an attack (test rule)' }[s.rules.counterChip]
  const picked = sides.map(id => list.find(r => r.id === id))
  const mixed = picked[0] && picked[1] && picked[0].rules !== picked[1].rules
  const v12 = picked.every(r => r?.rules === 12)
  const v15 = picked.every(r => r?.rules === 15)
  const v15Edition = list.every(r => r.rules === 15)
  const start = () => {
    const rs = sides.map(id => list.find(r => r.id === id))
    if (rs[0].rules !== rs[1].rules) return
    const levels = prefs.mode === 'ai' ? ['hard', difficulty] : ['hard', 'hard']
    const readerPrior = levels[1] === 'reader' && prefs.readerMemory !== false ? memory.obs : null
    onStart(M.startMatch({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: prefs.mode, settings: s, levels, id: newId('g'), readerPrior }))
  }
  const rulesNow = picked[0]?.rules ?? 11
  const memory = M.readerMemory(getState().games, rulesNow)
  return html`<div class="setup">
    <div class="stack">
      <h1>Fight night</h1>
      <p class="lede">${v15Edition
        ? 'Pick two fighters and play a full game under rules v15. Pressure beats Convert, Convert beats Recover, and Recover beats Pressure. Speed settles two attacks of the same type, and a tie cancels. Both move lists are open information; only the card you choose is hidden until the reveal.'
        : 'Pick two fighters and play a full game. The signed-off fighters play rules v11; drafts such as Clarence play rules v12, with kinds and speed. Both move lists are open information; only the card you choose is hidden until the reveal.'}</p>
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
    ${prefs.mode === 'ai' ? html`<div class="stack">
      <span class="label">Difficulty</span>
      <${Seg} value=${difficulty} options=${Object.entries(LEVELS).map(([k, l]) => [k, l.label])} onChange=${d => setPrefs({ ...prefs, difficulty: d })} label="Difficulty" />
      <p class="small muted">${LEVELS[difficulty].about} ${(v15Edition ? {
        easy: 'In the Benchmark mirror, Hard beats it about 57 games in 100: with no card text, few plays are ever bad.',
        medium: 'In the Benchmark mirror, Hard beats it about 52 games in 100.',
        hard: 'Two Hard partners split games evenly. Hard never adapts, so a pattern can do well against it: playing Recover every round beats it 63% of the time.',
        reader: 'Against sound play it is as strong as Hard. Against habits it is merciless: with 30 games of memory, Recover every round beats it 0% of the time, random play 35% (41% against Hard).',
      } : {
        easy: 'In testing, Hard beats it about 7 games in 10.',
        medium: 'In testing, Hard beats it about 6 games in 10, and it beats Easy about 6 in 10.',
        hard: 'Two Hard partners split games evenly.',
        reader: 'Calibrated on rules v15 only; on these rules it learns the same way, but its strength is untested.',
      })[difficulty]}</p>
      ${difficulty === 'reader' ? html`<label class="check"><input id="reader-memory" type="checkbox" checked=${prefs.readerMemory !== false} onChange=${e => setPrefs({ ...prefs, readerMemory: e.target.checked })} />
        Let it remember my habits from earlier games (${memory.games ? `${memory.games} logged game${memory.games > 1 ? 's' : ''} against the partner on these rules` : 'none logged yet on these rules'})</label>` : null}
    </div>` : null}
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${WHO[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${WHO[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP${r.rules === 12 && !v15Edition ? ' · rules v12' : ''}${r.rules === 15 && !v15Edition ? ' · rules v15' : ''}${r.fighter.epithet ? ` · ${r.fighter.epithet}` : ''}${r.fighter.passive ? ` · ${Object.keys(r.fighter.passive).map(p => PASSIVES[p]?.label).join(', ')}` : ''}</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input type="checkbox" checked=${prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the unexploitable mix after each reveal</label>
      ${v15 ? html`<label class="check"><input type="checkbox" checked=${prefs.hints !== false} onChange=${e => setPrefs({ ...prefs, hints: e.target.checked })} /> Show board notes while you pick (lethal range, missing types, speed duels, what a Recover would cost you)</label>` : null}
      ${mixed ? html`<p class="small msg-w">${picked[0].fighter.name} plays rules v${picked[0].rules} and ${picked[1].fighter.name} plays rules v${picked[1].rules}. Pick two fighters on the same rules.</p>` : null}
      <p class="small muted">${v15 ? `Rules v15: ${PAYOFF[s.rules.recoverPayoff] || PAYOFF.any}${s.rules.recoverPayoff === 'fixed' ? ` (${s.rules.fixedDamage ?? 2})` : ''}${s.rules.projectileSafe ? ', except against a Projectile' : ''}; ${TIE[s.rules.speedTie] || TIE.cancel}.` : v12 ? 'Rules v12: Recovers never chip; Guards and Counters turn the attacker\'s Build or chip back.' : `Recover chip lands ${ruleNote}.`} Change rules and the sparring partner's weights in Settings.</p>
      <div class="actions"><button class="btn" disabled=${mixed} onClick=${start}>Start the match</button></div>
    </div>
  </div>`
}

const SHORT = { ai: ['you', 'partner'], hotseat: ['player 1', 'player 2'], watch: ['partner 1', 'partner 2'] }

export function Table({ m, setM, prefs, onEnd }) {
  // in a mirror, say whose card is whose
  const names = m.f[0].name === m.f[1].name ? m.f.map((f, k) => `${f.name} (${SHORT[m.mode][k]})`) : m.f.map(f => f.name)
  const who = WHO[m.mode].map((w, k) => (!m.humans[k] && m.mode === 'ai' && m.levels?.[k] ? `${w} · ${LEVELS[m.levels[k]].label}` : w))
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
  const following = m.phase === 'follow'
  const P = picking || following ? m.picker : null
  const lockIn = () => { if (sel !== null) setM(M.lockIn(m, P, sel)) }
  const follow = pick => setM(M.chooseFollow(m, pick))
  const notes = picking && prefs.hints !== false ? M.boardNotes(m, P) : []
  const fw = following ? (() => {
    const pa = card(m.A, m.picks[0]), pb = card(m.B, m.picks[1])
    return m.follower === 0 ? [pa, pb] : [pb, pa]
  })() : null

  return html`<div class="table">
    <div class="board">
      <${Hud} X=${m.B} Y=${m.A} who=${who[1]} winsTies=${!!m.A.f.v15 && tieWinner15(m.A, m.B, m.rules) === 1} />
      <${Clash} m=${m} names=${names} prefs=${prefs} sel=${sel} />
      <${Hud} X=${m.A} Y=${m.B} who=${who[0]} winsTies=${!!m.A.f.v15 && tieWinner15(m.A, m.B, m.rules) === 0} />
      <section class="hand-wrap" aria-label="Your move">
        ${picking ? html`
          <div class="spread">
            <h3>${m.mode === 'ai' ? 'Your pick' : `${who[P]}'s pick`} · Round ${m.round}</h3>
            <div class="actions">
              <button class="btn" disabled=${sel === null} onClick=${lockIn}>Lock in</button>
            </div>
          </div>
          ${notes.length ? html`<ul class="notes" aria-label="Board notes">${notes.map(n => html`<li class=${n.tone || ''}>${n.text}</li>`)}</ul>` : null}
          <div class="hand">
            ${M.handView(X[P]).map(v => html`<div key=${v.i}>
              <${CardFace} as="button" card=${v.c.src} isSuper=${!!v.sup} hasFlow=${X[P].f.flow} rules=${rulesOf(X[P].f)}
                cls=${cx(!v.ok && 'off', sel === v.i && 'selected')} why=${v.why} disabled=${!v.ok}
                onClick=${() => v.ok && setSel(v.i)} />
            </div>`)}
          </div>` : null}
        ${following ? html`
          <div class="spread">
            <h3>${m.mode === 'ai' ? 'Your follow-up' : `${who[P]}'s follow-up`} · Round ${m.round}</h3>
            <div class="actions">
              <button class="btn" disabled=${sel === null} onClick=${() => follow(sel)}>Follow up</button>
              <button class="btn ghost" onClick=${() => follow(null)}>No follow-up</button>
            </div>
          </div>
          <p class="small">${fw[0].name} beat ${fw[1].name}, so ${m.mode === 'ai' ? 'you' : who[P]} may play one attack from hand, unopposed. It resolves in full and goes on cooldown too. ${(m.rules.recoverPayoff || 'any') === 'pressure' ? 'Under the current setting it must be a Pressure.' : ''}</p>
          <div class="hand">
            ${M.followView(m).map(v => html`<div key=${v.i}>
              <${CardFace} as="button" card=${v.c.src} isSuper=${!!v.sup} hasFlow=${X[P].f.flow} rules=${rulesOf(X[P].f)}
                cls=${cx(sel === v.i && 'selected')} onClick=${() => setSel(v.i)} />
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
      <${RoundLog} m=${m} names=${names} />
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
  const shown = m.phase === 'reveal' || m.phase === 'over' || m.phase === 'follow'
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
  const pend = m.phase === 'follow' ? m.pending : null
  const L = pend ? { before: [m.A, m.B], a: pend.a, b: pend.b, s: pend.s, events: pend.events } : m.last
  const ca = card(L.before[0], L.a), cb = card(L.before[1], L.b)
  const fu = L.s.followed
  const fuCard = fu ? card(L.before[fu.side], fu.i) : null
  const o = outcomeLine(ca, cb, [L.before[0].boost || 0, L.before[1].boost || 0], L.s, { rules: m.rules, names, hp: [L.before[0].hp, L.before[1].hp] })
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
      <${CardFace} card=${cb.src} isSuper=${cb.sup} hasFlow=${m.f[1].flow} rules=${rulesOf(m.f[1])} cls=${cx(o.winner === 1 && 'won', ev[1].beaten && 'beaten')} stamp=${ev[1].beaten ? 'Beaten' : null} />
      <span class="vs">VS</span>
      <${CardFace} card=${ca.src} isSuper=${ca.sup} hasFlow=${m.f[0].flow} rules=${rulesOf(m.f[0])} cls=${cx(o.winner === 0 && 'won', ev[0].beaten && 'beaten')} stamp=${ev[0].beaten ? 'Beaten' : null} />
    </div>
    <div class="outcome"><b>${o.title}</b><span>${o.sub}</span></div>
    ${fuCard ? html`<div class="followup">
      <span class="label">${names[fu.side]} follows up</span>
      <${CardFace} card=${fuCard.src} isSuper=${fuCard.sup} hasFlow=${m.f[fu.side].flow} rules=${rulesOf(m.f[fu.side])} cls="won" />
    </div>` : null}
    ${pend ? html`<p class="followup-ask">${m.mode === 'ai' ? 'You' : names[m.follower]} may follow up: choose an attack below, or skip it.</p>` : null}
    <div class="narr">
      ${[1, 0].map(k => html`<div>
        <b>${names[k]}</b>
        <span>${ev[k].card} ${ev[k].text}. <em>${deltaLine(L.before[k], k === 0 ? L.s.A : L.s.B)}</em></span>
      </div>`)}
    </div>
    ${!pend && m.history[m.history.length - 1]?.read ? html`<${ReadLine} entry=${m.history[m.history.length - 1]} names=${names} you=${m.mode === 'ai'} />` : null}
    ${prefs.odds && !pend ? html`<${Mixes} entry=${m.history[m.history.length - 1]} names=${names} f=${m.f} levels=${m.levels} />` : null}
  </section>`
}

// What the Reader predicted this round, after the reveal
function ReadLine({ entry, names, you }) {
  const r = entry.read, o = 1 - r.side
  const order = ['R', 'C', 'P'].sort((a, b) => r[b] - r[a])
  const label = { P: 'Pressure', C: 'Convert', R: 'Recover' }
  const played = entry.types[o]
  return html`<div class="readline">
    <span class="label">The Reader's read</span>
    <p>It expected ${you ? 'you' : names[o]} to play ${order.filter(t => r[t] >= 0.005).map(t => `${label[t]} ${Math.round(100 * r[t])}%`).join(', ')}${you ? '; you played' : `; ${names[o]} played`} ${label[played] || played}.${' '}<span class="muted">${r.n ? `From ${r.n} round${r.n === 1 ? '' : 's'} like this, it leaned ${Math.round(100 * r.lean)}% on that read; the rest is Hard's mix.` : 'It had nothing to go on yet, so it played Hard\'s mix.'}</span></p>
  </div>`
}

function Mixes({ entry, names, f, levels }) {
  const typeOf = (k, name) => [...f[k].cards, f[k].sup].find(c => c?.name === name)?.t || 'T'
  const row = (k, mix, label) => html`<div class="stack" style=${{ gap: '4px' }}>
    <span class="small">${label}: ${mix.filter(([, p]) => p >= 0.01).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(', ')}</span>
    <div class="mixbar">${mix.filter(([, p]) => p >= 0.01).map(([n, p]) => html`<span data-t=${typeOf(k, n)} style=${{ width: `${p * 100}%` }} title=${`${n} ${Math.round(p * 100)}%`}>${p > 0.12 ? n : ''}</span>`)}</div>
  </div>`
  return html`<div class="mix">
    <span class="label">The unexploitable mix this round</span>
    ${row(1, entry.mix.b, names[1])}
    ${row(0, entry.mix.a, names[0])}
    ${entry.mix.playedB ? row(1, entry.mix.playedB, `${names[1]} actually played from (${LEVELS[levels[1]].label})`) : null}
    ${entry.mix.playedA ? row(0, entry.mix.playedA, `${names[0]} actually played from (${LEVELS[levels[0]].label})`) : null}
  </div>`
}

function RoundLog({ m, names }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Rounds</h3><p class="small muted">Each round's cards and the board after it appear here.</p></div>`
  return html`<div class="panel stack">
    <h3>Rounds</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class="log-row" key=${r.n}>
        <b>${r.n}</b>
        <div>
          <div class="vsline"><span class="tdot" data-t=${r.types[0]}></span>${r.cards[0]} <span class="muted">vs</span> <span class="tdot" data-t=${r.types[1]}></span>${r.cards[1]}${r.followed ? html`<span class="muted">· ${names[r.followed.side]} follows up:</span><span class="tdot" data-t=${r.followed.t}></span>${r.followed.name}` : null}</div>
          <div class="small muted num">${names[0]} ${r.after[0].hp} HP · ${r.after[0].pile} grey — ${names[1]} ${r.after[1].hp} HP · ${r.after[1].pile} grey</div>
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
