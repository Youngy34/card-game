// Play (rules v16): pick fighters and a mode, then play the match: the neutral
// phase, the clash, follow-ups and combos, and the draw.

import { html, cx, useState, useEffect, useRef } from '../lib.js'
import { Card16, Back16 } from './card16.js'
import { LifeBar, Tokens, Seg, StatusChip } from '../ui.js'
import { roster, saveGame, newId } from '../store.js'
import { settings16 } from './fighters16.js'
import * as M from './match16.js'
import { card16, neutralOptions16, statusList, superReady } from '../../engine/v16/engine.js'
import { ICONS, LABEL16, STATUSES } from '../../engine/v16/cards.js'
import { deckSize } from '../../engine/v16/cards.js'
import { narrate16, outcomeTitle16, neutralLine16 } from './narrate16.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const SHORT = { ai: ['you', 'partner'], hotseat: ['player 1', 'player 2'], watch: ['partner 1', 'partner 2'] }

export function Setup16({ onStart, prefs, setPrefs }) {
  const list = roster().filter(r => r.rules === 16)
  const ids = list.map(r => r.id)
  const sides = prefs.sides.map((id, k) => (ids.includes(id) ? id : ids[k % Math.max(ids.length, 1)]))
  const pick = (k, id) => setPrefs({ ...prefs, sides: sides.map((s, i) => (i === k ? id : s)) })
  const s = settings16()
  const levels = Object.entries(M.LEVELS16)
  const difficulty = M.LEVELS16[prefs.difficulty] ? prefs.difficulty : 'hard'
  const start = () => {
    const rs = sides.map(id => list.find(r => r.id === id))
    const lv = prefs.mode === 'ai' ? ['hard', difficulty] : ['hard', 'hard']
    onStart(M.startMatch16({ fighters: rs.map(r => r.fighter), statuses: rs.map(r => r.status), mode: prefs.mode, settings: s, levels: lv, id: newId('g') }))
  }
  if (!list.length) return html`<div class="stack"><h1>Fight night</h1><p class="muted">No v16 fighters yet.</p></div>`
  return html`<div class="setup">
    <div class="stack">
      <h1>Fight night</h1>
      <p class="lede">Rules v16: each fighter plays a shuffled deck, and hands are hidden. Each round has a neutral phase (play a neutral card, burn cards for meter, or draw an extra card), the clash, and a draw. Win a read with a Starter and you combo; Guard a Pressure and you punish with a Counter.</p>
    </div>
    <div class="stack">
      <span class="label">Mode</span>
      <${Seg} value=${prefs.mode} options=${MODES} onChange=${mode => setPrefs({ ...prefs, mode })} label="Mode" />
      <p class="small muted">${{
        ai: 'The sparring partner can\'t see your hand: it deals you a few possible hands from the cards it hasn\'t seen, and plays the mix that\'s safest against them.',
        hotseat: 'Hands are hidden, so the screen asks for the device to change hands before each private choice.',
        watch: 'Step through a game between two sparring partners.',
      }[prefs.mode]}</p>
    </div>
    ${prefs.mode === 'ai' ? html`<div class="stack">
      <span class="label">Difficulty</span>
      <${Seg} value=${difficulty} options=${levels.map(([k, l]) => [k, l.label])} onChange=${d => setPrefs({ ...prefs, difficulty: d })} label="Difficulty" />
      <p class="small muted">${M.LEVELS16[difficulty].about} ${{ easy: 'In the Benchmark mirror, Hard beats it about 7 games in 10.', medium: 'In the Benchmark mirror, Hard beats it about 53 games in 100.', hard: 'It doesn\'t learn your habits yet (the Reader isn\'t on v16).' }[difficulty]}</p>
    </div>` : null}
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${M.WHO16[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${M.WHO16[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP · ${deckSize(r.fighter)} cards${r.fighter.super ? ` · Super: ${r.fighter.super.name}` : ''}</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input type="checkbox" checked=${prefs.hints !== false} onChange=${e => setPrefs({ ...prefs, hints: e.target.checked })} /> Show board notes while you choose (lethal range, live Supers, statuses, Counters they could hold, speed duels)</label>
      <label class="check"><input type="checkbox" checked=${!!prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the sparring partner's mix after each reveal</label>
      ${prefs.mode === 'watch' ? html`<label class="check"><input type="checkbox" checked=${!!prefs.showHands} onChange=${e => setPrefs({ ...prefs, showHands: e.target.checked })} /> Show both hands</label>` : null}
      <p class="small muted">Opening hand ${s.rules.openingHand}, hand limit ${s.rules.handLimit}; burn up to ${s.rules.burnMax} a round for meter (max ${s.rules.meterMax}); the Super is ${s.rules.superUses ? 'once per game' : 'reusable (meter is the gate)'}; speed ties ${s.rules.speedTie === 'lowhp' ? 'go to the player on less HP' : 'cancel'}. Change these in Settings.</p>
      <div class="actions"><button class="btn" onClick=${start}>Start the match</button></div>
    </div>
  </div>`
}

// ---- the table ------------------------------------------------------------------------
export function Table16({ m, setM, prefs, onEnd }) {
  const names = m.json[0].name === m.json[1].name ? m.json.map((f, k) => `${f.name} (${SHORT[m.mode][k]})`) : m.json.map(f => f.name)
  const who = M.WHO16[m.mode].map((w, k) => (!m.humans[k] && m.mode === 'ai' ? `${w} · ${M.LEVELS16[m.levels[k]]?.label || m.levels[k]}` : w))
  const [saveState, setSaveState] = useState(null)
  const [auto, setAuto] = useState(false)
  const savedFor = useRef(null)
  const X = [m.G.A, m.G.B]
  const me = m.mode === 'ai' ? 0 : m.mode === 'hotseat' ? (m.turn !== null && !m.pass ? m.turn : null) : null

  useEffect(() => {
    if (m.phase !== 'over' || savedFor.current === m.id || !m.humans.some(Boolean)) return
    savedFor.current = m.id
    setSaveState('saving')
    saveGame(M.gameRecord16(m)).then(() => setSaveState('saved'), e => setSaveState(`error: ${e.message}`))
  }, [m.phase, m.id])

  useEffect(() => {
    if (m.mode !== 'watch' || !auto || m.phase !== 'reveal') return
    const t = setTimeout(() => setM(mm => (mm.phase === 'reveal' ? M.nextRound16(mm) : mm)), 1400)
    return () => clearTimeout(t)
  }, [auto, m.phase, m.G.round, m.mode])

  const myTurn = m.turn !== null && m.humans[m.turn] && !m.pass
  const bottom = m.mode === 'hotseat' && m.turn === 1 && !m.pass ? 1 : 0     // the deciding player sits at the bottom
  const top = 1 - bottom

  return html`<div class="table">
    <div class="board">
      <${Hud16} X=${X[top]} who=${who[top]} m=${m} />
      <${Stage16} m=${m} names=${names} prefs=${prefs} />
      <${Hud16} X=${X[bottom]} who=${who[bottom]} m=${m} />
      <section class="hand-wrap" aria-label="Your move">
        ${myTurn ? html`<${Action16} m=${m} setM=${setM} side=${m.turn} prefs=${prefs} names=${names} who=${who} />` : null}
        ${!myTurn && m.phase === 'reveal' ? html`<div class="actions">
          <button class="btn" onClick=${() => setM(M.nextRound16(m))}>Draw · next round</button>
          ${m.mode === 'watch' ? html`<label class="check"><input type="checkbox" checked=${auto} onChange=${e => setAuto(e.target.checked)} /> Play on automatically</label>` : null}
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
        ${me !== null && !myTurn && m.phase !== 'over' ? html`<${HandView} X=${X[me]} title="Your hand" />` : null}
        ${m.mode === 'watch' && prefs.showHands ? [1, 0].map(k => html`<${HandView} X=${X[k]} title=${`${names[k]}'s hand`} />`) : null}
      </section>
    </div>
    <aside class="side">
      <${RoundLog16} m=${m} names=${names} />
      <${DeckPanel} X=${X[1]} title=${`Deck · ${names[1]}`} mine=${me === 1 || (m.mode === 'watch' && prefs.showHands)} />
      <${DeckPanel} X=${X[0]} title=${`Deck · ${names[0]}`} mine=${me === 0 || m.mode === 'ai' || (m.mode === 'watch' && prefs.showHands)} />
      <div class="actions"><button class="link" onClick=${() => onEnd('quit')}>Leave this match</button></div>
    </aside>
    ${m.pass && m.turn !== null ? html`<div class="overlay" role="dialog" aria-label="Pass the device">
      <div class="overlay-box">
        <span class="label">Round ${m.G.round}</span>
        <h2>Pass the device to ${who[m.turn]}</h2>
        <p class="lede">${{ neutral: 'Their neutral action', clash: 'Their clash card', stage: 'Their follow-up or combo', discard: 'Their discard' }[m.phase] || 'Their choice'} is private: hands are hidden.</p>
        <button class="btn" onClick=${() => setM(M.continueAfterPass(m))}>I'm ${who[m.turn]}</button>
      </div>
    </div>` : null}
  </div>`
}

function Hud16({ X, who, m }) {
  const top = X.discard.length ? X.discard[X.discard.length - 1] : null
  const now = statusList(X.st), next = m.phase === 'reveal' || m.phase === 'over' ? statusList(X.next) : []
  const sup = X.f.sup
  return html`<section class="hud" aria-label=${`${X.f.name}'s side`}>
    <div class="hud-head">
      <span class="hud-name">${X.f.name}</span>
      <span class="hud-who">${who}</span>
      <span class="hud-flags">
        ${now.map(s => html`<span class="flag status" title="This round">${s}</span>`)}
        ${next.map(s => html`<span class="flag status next" title="Next round">Next: ${s}</span>`)}
        ${sup ? html`<span class=${cx('flag sup', superReady(X, m.G.rules) && 'ready', m.G.rules.superUses > 0 && X.supersUsed >= m.G.rules.superUses && 'spent')} title=${`${sup.name}: ${sup.meter} meter`}>${sup.name} ${superReady(X, m.G.rules) ? 'ready' : m.G.rules.superUses > 0 && X.supersUsed >= m.G.rules.superUses ? 'used' : `${Math.min(X.meter, sup.meter)}/${sup.meter}`}</span>` : null}
      </span>
    </div>
    <${LifeBar} X=${X} />
    <div class="hud-row">
      <div class="pile"><span class="label">Grey</span><span class="pile-n">${X.pile}</span><${Tokens} n=${X.pile} /></div>
      <div class="meter" aria-label=${`Meter ${X.meter} of ${m.G.rules.meterMax}`}><span class="label">Meter</span>${Array.from({ length: m.G.rules.meterMax }, (_, i) => html`<span class=${cx('pipm', i < X.meter && 'on')}></span>`)}</div>
    </div>
    <div class="hud-row small">
      <span class="count"><b>${X.hand.length}</b> in hand</span>
      <span class="count"><b>${X.deck.length}</b> in deck</span>
      <span class="count"><b>${X.discard.length}</b> discarded${top ? html`<span class="muted"> · top: ${top.burned ? 'a burned card' : X.f.cards[top.i].name}</span>` : null}</span>
      ${X.reshuffles ? html`<span class="count muted">reshuffled ${X.reshuffles}×</span>` : null}
    </div>
  </section>`
}

function Stage16({ m, names, prefs }) {
  const G = m.G
  const shown = m.last && (m.phase === 'reveal' || m.phase === 'over')
  const neutral = shown ? m.last.neutral : G.neutral
  const clash = shown ? m.last.clash : (m.phase === 'stage' ? G.clash : null)
  const res = m.result
  return html`<section class="clash" aria-label="The round" aria-live="polite">
    ${m.phase === 'over' ? html`<div class="outcome">
      <span class="ko">${res === 0.5 ? 'Draw' : 'K.O.'}</span>
      <b>${res === 0.5 ? 'Round limit reached' : `${names[res === 1 ? 0 : 1]} wins`}</b>
      <span>Round ${G.round}.</span>
    </div>` : null}
    <span class="label">Round ${G.round} · ${{ neutral: 'Neutral phase', clash: 'Clash', stage: 'Clash', reveal: 'Result', discard: 'Draw phase', over: 'Result' }[m.phase]}</span>
    ${neutral ? html`<div class="neutral-line">${[1, 0].map(k => html`<div><b>${names[k]}</b> <span>${neutralLine16(neutral[k], m.G[k === 0 ? 'A' : 'B'].f)}</span></div>`)}</div>` : null}
    ${!clash ? html`<div class="clash-cards">
      ${[1, 0].map((k, n) => html`${n ? html`<span class="vs">VS</span>` : null}<div class="card card-back" style=${{ opacity: (m.phase === 'clash' && m.picks[k] !== undefined) ? 1 : 0.35 }}><span>${m.phase === 'clash' && m.picks[k] !== undefined ? 'YOMI' : '?'}</span></div>`)}
    </div>
    <p class="small muted">${m.phase === 'neutral' ? 'Both neutral actions reveal together, then both clash cards.' : m.phase === 'clash' ? 'Both clash cards reveal together.' : m.phase === 'discard' ? 'Drawing: over the hand limit, so a discard first.' : ''}</p>` : html`<${ClashView} m=${m} clash=${clash} names=${names} prefs=${prefs} />`}
  </section>`
}

function ClashView({ m, clash, names, prefs }) {
  const X = [m.G.A, m.G.B]
  const face = (k, i, cls, stamp) => (i === null || i === undefined ? html`<div class="card card-back" style=${{ opacity: 0.4 }}><span>—</span></div>`
    : html`<${Card16} card=${card16(X[k], i).src} isSuper=${i === 'S'} cls=${cls} stamp=${stamp} />`)
  const w = clash.winner
  const beaten = k => w >= 0 && w !== k && clash.picks[k] !== null
  const o = outcomeTitle16(clash, names)
  const extra = [...(clash.follow ? [{ ...clash.follow, stage: 'follow' }] : []), ...clash.combo]
  const lines = narrate16(clash.events, names)
  const last = m.history[m.history.length - 1]
  return html`
    <div class="clash-cards">
      ${face(1, clash.picks[1], cx(w === 1 && 'won', beaten(1) && 'beaten'), beaten(1) ? 'Beaten' : clash.outcome === 'cancel' ? 'Tie' : null)}
      <span class="vs">VS</span>
      ${face(0, clash.picks[0], cx(w === 0 && 'won', beaten(0) && 'beaten'), beaten(0) ? 'Beaten' : clash.outcome === 'cancel' ? 'Tie' : null)}
    </div>
    <div class="outcome"><b>${o.title}</b><span>${o.sub}</span></div>
    ${extra.length ? html`<div class="combo-row">${extra.map(x => html`<div class="stack" style=${{ gap: '4px', justifyItems: 'center' }}>
      <span class="label">${{ follow: 'Follow-up', link: 'Linker', end: 'Ender' }[x.stage]}</span>
      <${Card16} card=${(x.name === X[x.side].f.sup?.name ? X[x.side].f.sup : X[x.side].f.cards.find(c => c.name === x.name)).src} isSuper=${x.name === X[x.side].f.sup?.name} cls="won small" />
    </div>`)}</div>` : null}
    ${m.phase === 'stage' ? html`<p class="followup-ask">${m.mode === 'ai' && m.turn === 0 ? 'You' : names[m.turn]} ${m.G.pending.stage === 'follow' ? 'may follow up with a Counter' : m.G.pending.stage === 'link' ? 'may combo: a Linker, then an Ender' : 'may end the combo with an Ender'}.</p>` : null}
    <ul class="narr16">${lines.map(l => html`<li>${l}</li>`)}</ul>
    ${prefs.odds && last?.mix && m.phase !== 'stage' ? html`<div class="mix">
      <span class="label">The sparring partner's mix this round</span>
      ${[1, 0].map(k => last.mix[k] ? html`<span class="small">${names[k]}: ${last.mix[k].filter(([, p]) => p >= 0.01).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(', ')}</span>` : null)}
    </div>` : null}`
}

// ---- what the deciding player does --------------------------------------------------
function Action16({ m, setM, side, prefs, names, who }) {
  const X = side === 0 ? m.G.A : m.G.B
  const [sel, setSel] = useState(null)
  const [burn, setBurn] = useState(null)        // null, or the hand positions picked to burn
  useEffect(() => { setSel(null); setBurn(null) }, [m.phase, m.G.round, m.turn, m.G.pending?.stage])
  const youName = m.mode === 'ai' ? 'Your' : `${who[side]}'s`
  const notes = prefs.hints !== false && (m.phase === 'clash' || m.phase === 'neutral') ? M.boardNotes16(m, side) : []
  const Notes = notes.length ? html`<ul class="notes" aria-label="Board notes">${notes.map(n => html`<li class=${n.tone || ''}>${n.text}</li>`)}</ul>` : null

  if (m.phase === 'neutral') {
    const o = neutralOptions16(X, m.G.rules)
    const groups = M.handGroups(X, burn ? null : new Set(o.neutrals))
    if (burn) {
      const hand = X.hand.map((i, pos) => ({ i, pos, c: X.f.cards[i] }))
      const toggle = pos => setBurn(b => (b.includes(pos) ? b.filter(p => p !== pos) : b.length < o.maxBurn ? [...b, pos] : b))
      return html`<div class="spread"><h3>${youName} neutral action · burn for meter</h3>
        <div class="actions">
          <button class="btn" disabled=${!burn.length} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'burn', cards: burn.map(p => X.hand[p]) }))}>Burn ${burn.length || ''}</button>
          <button class="btn ghost" onClick=${() => setBurn(null)}>Back</button>
        </div></div>
        <p class="small">Pick up to ${o.maxBurn} card${o.maxBurn > 1 ? 's' : ''}: 1 meter each (you have ${X.meter} of ${m.G.rules.meterMax}). They go face down under your discard pile; the opponent sees how many, not which.</p>
        <div class="hand">${hand.map(h => html`<div key=${h.pos}><${Card16} as="button" card=${h.c.src} cls=${cx(burn.includes(h.pos) && 'selected')} onClick=${() => toggle(h.pos)} /></div>`)}</div>`
    }
    return html`<div class="spread"><h3>${youName} neutral action · Round ${m.G.round}</h3></div>
      ${Notes}
      <div class="actions">
        <button class="btn" onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'draw' }))}>Draw a card</button>
        <button class="btn ghost" disabled=${!o.maxBurn} onClick=${() => setBurn([])}>Burn for meter…</button>
        <button class="btn ghost" disabled=${sel === null} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'neutral', i: sel }))}>Play ${sel !== null ? X.f.cards[sel].name : 'a neutral card'}</button>
        <button class="link" onClick=${() => setM(M.chooseNeutral(m, side, null))}>Do nothing</button>
      </div>
      <p class="small muted">${o.neutrals.length ? 'To play a neutral card, pick it below.' : 'You hold no neutral cards.'} ${!o.maxBurn ? (X.meter >= m.G.rules.meterMax ? 'Your meter is full.' : '') : ''}</p>
      <div class="hand">${groups.map(g => html`<div key=${g.i}>${g.c.t === 'N'
        ? html`<${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} cls=${cx(sel === g.i && 'selected')} onClick=${() => setSel(g.i)} />`
        : html`<${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} />`}</div>`)}</div>`
  }

  if (m.phase === 'clash') {
    const ok = M.clashSet(m, side)
    const groups = M.handGroups(X, ok, M.clashWhy(X))
    const sup = X.f.sup
    return html`<div class="spread"><h3>${youName} clash card · Round ${m.G.round}</h3>
        <div class="actions"><button class="btn" disabled=${sel === null} onClick=${() => setM(M.choosePick(m, side, sel))}>Lock in</button></div></div>
      ${Notes}
      <div class="hand">
        ${groups.map(g => html`<div key=${g.i}><${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} disabled=${!g.ok} why=${g.why}
          cls=${cx(!g.ok && 'off', sel === g.i && 'selected')} onClick=${() => g.ok && setSel(g.i)} /></div>`)}
        ${sup ? html`<div key="S"><${Card16} as="button" card=${sup.src} isSuper=${true} disabled=${!ok.has('S')} why=${ok.has('S') ? null : `${X.meter} of ${sup.meter} meter`}
          cls=${cx(!ok.has('S') && 'off', sel === 'S' && 'selected')} onClick=${() => ok.has('S') && setSel('S')} /></div>` : null}
      </div>`
  }

  if (m.phase === 'stage') {
    const p = m.G.pending
    const ok = new Set(p.options)
    const groups = M.handGroups(X, ok, () => ({ follow: 'Not a Counter', link: 'Not a Linker', end: 'Not an Ender' })[p.stage])
    const sup = X.f.sup
    const what = { follow: 'Follow up with a Counter', link: 'Combo: play a Linker', end: 'End the combo: play an Ender' }[p.stage]
    return html`<div class="spread"><h3>${what}</h3>
        <div class="actions">
          <button class="btn" disabled=${sel === null} onClick=${() => setM(M.chooseStage(m, sel))}>Play it</button>
          <button class="btn ghost" onClick=${() => setM(M.chooseStage(m, null))}>${p.stage === 'link' ? 'Skip the Linker' : p.stage === 'end' ? 'No Ender' : 'No follow-up'}</button>
        </div></div>
      <p class="small">${p.stage === 'follow' ? 'Your Guard beat their Pressure: one Counter from your hand lands unopposed. It never starts a combo.' : p.stage === 'link' ? 'Your Starter landed. A Linker lands unopposed, then you may end with an Ender. Skip the Linker to go straight to the Ender.' : 'An Ender lands unopposed and ends the combo: a Convert cashes the whole pile, a status Ender leaves them loaded.'}</p>
      <div class="hand">
        ${groups.map(g => html`<div key=${g.i}><${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} disabled=${!g.ok} why=${g.why}
          cls=${cx(!g.ok && 'off', sel === g.i && 'selected')} onClick=${() => g.ok && setSel(g.i)} /></div>`)}
        ${sup && ok.has('S') ? html`<div key="S"><${Card16} as="button" card=${sup.src} isSuper=${true} cls=${cx(sel === 'S' && 'selected')} onClick=${() => setSel('S')} /></div>` : null}
      </div>`
  }

  if (m.phase === 'discard') {
    const need = m.G.discardDown[side]
    const [pick, setPick] = [sel || [], v => setSel(v)]
    const hand = X.hand.map((i, pos) => ({ i, pos, c: X.f.cards[i] }))
    const toggle = pos => setPick(pick.includes(pos) ? pick.filter(p => p !== pos) : pick.length < need ? [...pick, pos] : pick)
    return html`<div class="spread"><h3>Discard down to ${m.G.rules.handLimit}</h3>
        <div class="actions"><button class="btn" disabled=${pick.length !== need} onClick=${() => setM(M.chooseDiscard(m, side, pick.map(p => X.hand[p])))}>Discard ${need}</button></div></div>
      <p class="small">You're over the hand limit: pick ${need} card${need > 1 ? 's' : ''} to discard (face up).</p>
      <div class="hand">${hand.map(h => html`<div key=${h.pos}><${Card16} as="button" card=${h.c.src} cls=${cx(pick.includes(h.pos) && 'selected')} onClick=${() => toggle(h.pos)} /></div>`)}</div>`
  }
  return null
}

function HandView({ X, title }) {
  const groups = M.handGroups(X)
  return html`<div class="stack" style=${{ gap: '8px' }}>
    <span class="label">${title} · ${X.hand.length}</span>
    <div class="hand">${groups.map(g => html`<div key=${g.i}><${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} /></div>`)}</div>
  </div>`
}

function RoundLog16({ m, names }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Rounds</h3><p class="small muted">Each round's neutral actions, cards and the board after it appear here.</p></div>`
  const nl = a => ({ draw: 'drew', neutral: a.name, burn: `burned ${a.n}`, none: '—', skip: a.why ? a.why.toLowerCase() : 'skipped' })[a.kind] || a.kind
  return html`<div class="panel stack">
    <h3>Rounds</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class="log-row" key=${r.n}>
        <b>${r.n}</b>
        <div>
          <div class="small muted">Neutral: ${names[0]} ${nl(r.neutral[0])} · ${names[1]} ${nl(r.neutral[1])}</div>
          <div class="vsline"><span class="tdot" data-t=${r.types[0] || 'T'}></span>${r.cards[0] || 'nothing'} <span class="muted">vs</span> <span class="tdot" data-t=${r.types[1] || 'T'}></span>${r.cards[1] || 'nothing'}
            ${r.follow ? html`<span class="muted">· follow-up:</span> ${r.follow.name}` : null}
            ${r.combo.length ? html`<span class="muted">· combo:</span> ${r.combo.map(x => x.name).join(' → ')}` : null}</div>
          <div class="small muted num">${names[0]} ${r.after[0].hp} HP · ${r.after[0].pile} grey — ${names[1]} ${r.after[1].hp} HP · ${r.after[1].pile} grey</div>
        </div>
      </div>`)}
    </div>
  </div>`
}

// A deck's cards and where they are. For the opponent: how many of each you haven't seen.
function DeckPanel({ X, title, mine }) {
  const [open, setOpen] = useState(false)
  const n = X.f.cards.map(() => ({ hand: 0, deck: 0, discard: 0, burned: 0 }))
  for (const i of X.hand) n[i].hand++
  for (const i of X.deck) n[i].deck++
  for (const d of X.discard) n[d.i][d.burned ? 'burned' : 'discard']++
  return html`<details class="panel details" open=${open} onToggle=${e => setOpen(e.target.open)}>
    <summary class="spread"><h3>${title}</h3><span class="small muted">${open ? 'Hide' : 'Show'}</span></summary>
    ${open ? html`<div class="stack" style=${{ marginTop: '12px', gap: '6px' }}>
      <div class="spread small muted"><span>Card</span><span>${mine ? 'hand · deck · discarded' : 'unseen · discarded'}</span></div>
      ${X.f.cards.map((c, i) => html`<div class="spread small">
        <span class="row" style=${{ gap: '8px' }}><span class="tdot" data-t=${c.t === 'N' ? 'T' : c.t}></span>${c.name} <span class="muted">×${c.copies}</span>${c.counter ? html`<span class="icon counter tiny">Ct</span>` : null}</span>
        <span class="num">${mine ? `${n[i].hand} · ${n[i].deck} · ${n[i].discard + n[i].burned}` : `${n[i].hand + n[i].deck + n[i].burned} · ${n[i].discard}`}</span>
      </div>`)}
      <p class="small muted">${mine ? 'Burned cards count as discarded.' : 'Unseen: in their deck, their hand, or burned face down.'}</p>
    </div>` : null}
  </details>`
}
