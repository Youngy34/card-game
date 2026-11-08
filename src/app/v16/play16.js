// Play (rules v16): pick fighters and a mode, then play the match: the neutral
// phase, the clash, follow-ups and combos, and the draw.

import { html, cx, useState, useEffect, useRef } from '../lib.js'
import { Card16, Back16 } from './card16.js'
import { LifeBar, Tokens, Seg, StatusChip } from '../ui.js'
import { roster, saveGame, newId } from '../store.js'
import { settings16 } from './fighters16.js'
import * as M from './match16.js'
import { card16, neutralOptions16, statusList, superReady, handLimitOf, tableCost } from '../../engine/v16/engine.js'
import { ICONS, LABEL16, STATUSES, CONFISCATE_LINE } from '../../engine/v16/cards.js'
import { deckSize } from '../../engine/v16/cards.js'
import { narrate16, outcomeTitle16, neutralLine16 } from './narrate16.js'

const MODES = [['ai', 'You vs sparring partner'], ['hotseat', 'Two players, one device'], ['watch', 'Watch the sparring partner']]
const SHORT = { ai: ['you', 'partner'], hotseat: ['player 1', 'player 2'], watch: ['partner 1', 'partner 2'] }

export function Setup16({ onStart, prefs, setPrefs }) {
  const list = roster().filter(r => r.rules >= 16)
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
      <p class="lede">${s.rules.merged ? 'Rules v18: each fighter plays one shuffled deck (24 to 26 cards), gone through once, with hands hidden. Each round, both play a clash card together; riders on the cards (Charge, Read, Recall) fire on reveal, win or lose. Specials and the Super wait face up on the table until a Read takes them for meter; a special goes back to the table once used, the Super is used once. The initiative token wins speed ties and goes first wherever there\'s an order. When a player draws their last card the game times out: the higher HP wins.' : s.rules.tableCards ? 'Rules v17: each fighter plays a shuffled deck, with hands hidden. Each round: both play a neutral card together, then both a clash card, then a draw. Specials and the Super wait face up on the table until Read takes them for meter; the Super is used once. The initiative token wins speed ties and goes first wherever there\'s an order, and it passes every round.' : 'Rules v16: each fighter plays a shuffled deck, and hands are hidden. Each round has a neutral step (play a neutral card), the clash, and a draw.'} Win a read with a Starter and you combo; Guard a Pressure and you punish with a Counter${s.rules.merged ? ', unless it\'s Safe. Knocked down, you lose every speed clash next round' : ''}.</p>
    </div>
    <div class="stack">
      <span class="label">Mode</span>
      <${Seg} value=${prefs.mode} options=${MODES} onChange=${mode => setPrefs({ ...prefs, mode })} label="Mode" />
      <p class="small muted">${{
        ai: s.rules.merged ? 'The sparring partner can\'t see your hand: it deals you a few possible hands from the cards it hasn\'t seen, and it knows you can\'t see its own, so it plays the mix that\'s safest across all of them.' : 'The sparring partner can\'t see your hand: it deals you a few possible hands from the cards it hasn\'t seen, and plays the mix that\'s safest against them.',
        hotseat: 'Hands are hidden, so the screen asks for the device to change hands before each private choice.',
        watch: 'Step through a game between two sparring partners.',
      }[prefs.mode]}</p>
    </div>
    ${prefs.mode === 'ai' ? html`<div class="stack">
      <span class="label">Difficulty</span>
      <${Seg} value=${difficulty} options=${levels.map(([k, l]) => [k, l.label])} onChange=${d => setPrefs({ ...prefs, difficulty: d })} label="Difficulty" />
      <p class="small muted">${M.LEVELS16[difficulty].about} ${(s.rules.merged ? { easy: 'In the Benchmark mirror, Hard beats it about 65 games in 100.', medium: 'In the Benchmark mirror, Hard beats it about 59 games in 100.', hard: 'It doesn\'t learn your habits, and it doesn\'t know about the time-out.' } : { easy: 'In the Benchmark mirror, Hard beats it about 7 games in 10.', medium: 'In the Benchmark mirror, Hard beats it about 53 games in 100.', hard: 'It doesn\'t learn your habits yet (the Reader isn\'t on v16).' })[difficulty]}</p>
    </div>` : null}
    <div class="pickers">
      ${[0, 1].map(k => html`<div class="stack">
        <span class="label">${M.WHO16[prefs.mode][k]}</span>
        <div class="fighters" role="group" aria-label=${`${M.WHO16[prefs.mode][k]}'s fighter`}>
          ${list.map(r => html`<button class="fpick" type="button" aria-pressed=${sides[k] === r.id ? 'true' : 'false'} onClick=${() => pick(k, r.id)}>
            <strong>${r.fighter.name}</strong><${StatusChip} status=${r.status} />
            <span class="meta">${r.fighter.hp} HP · ${r.fighter.rules === 18 ? oneDeckSize(r.fighter) : splitSize(r.fighter)}${r.fighter.super ? ` · Super: ${r.fighter.super.name}` : ''}</span>
          </button>`)}
        </div>
      </div>`)}
    </div>
    <div class="stack">
      <label class="check"><input type="checkbox" checked=${prefs.hints !== false} onChange=${e => setPrefs({ ...prefs, hints: e.target.checked })} /> Show board notes while you choose (lethal range, live Supers, statuses, Counters they could hold, speed duels)</label>
      <label class="check"><input type="checkbox" checked=${!!prefs.odds} onChange=${e => setPrefs({ ...prefs, odds: e.target.checked })} /> Show the sparring partner's mix after each reveal</label>
      ${prefs.mode === 'watch' ? html`<label class="check"><input type="checkbox" checked=${!!prefs.showHands} onChange=${e => setPrefs({ ...prefs, showHands: e.target.checked })} /> Show both hands</label>` : null}
      <p class="small muted">Opening hand ${s.rules.openingHand}, hand limit ${s.rules.handLimit}; ${neutralRule(s.rules)}${greyRule(s.rules)}; meter track 0–${s.rules.meterMax}; the Super is ${s.rules.tableCards ? 'taken from the table and used once' : s.rules.superUses ? 'once per game' : 'reusable (meter is the gate)'}; speed ties ${tieRule(s.rules)}${s.rules.timeout ? '; no reshuffle: the game times out when a deck runs out' : ''}. Change these in Settings.</p>
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
          <button class="btn" onClick=${() => setM(M.nextRound16(m))}>${(m.G.rules.greyPerRound ?? 0) > 0 ? `Draw · take ${m.G.rules.greyPerRound} grey · ${m.G.rules.initiative ? 'pass the initiative' : 'next round'}` : 'Draw · next round'}</button>
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
        <p class="lede">${{ neutral: 'Their neutral action', clash: 'Their clash card', stage: 'Their follow-up or combo', discard: 'Their discard', confiscate: 'What they lose to Confiscate', option: 'Their neutral card\'s option', rider: 'Their rider\'s choice' }[m.phase] || 'Their choice'} is private: hands are hidden.</p>
        <button class="btn" onClick=${() => setM(M.continueAfterPass(m))}>I'm ${who[m.turn]}</button>
      </div>
    </div>` : null}
  </div>`
}

function Hud16({ X, who, m }) {
  const top = X.discard.length ? X.discard[X.discard.length - 1] : null
  const Y = X === m.G.A ? m.G.B : m.G.A
  const cap = Y.inPlay != null && Y.f.cards[Y.inPlay].capHand ? handLimitOf(X, Y, m.G.rules) : null
  const now = statusList(X.st), next = m.phase === 'reveal' || m.phase === 'over' ? statusList(X.next) : []
  const sup = X.f.sup
  return html`<section class="hud" aria-label=${`${X.f.name}'s side`}>
    <div class="hud-head">
      <span class="hud-name">${X.f.name}</span>
      <span class="hud-who">${who}</span>
      <span class="hud-flags">
        ${m.G.rules.initiative && m.G.init === (X === m.G.A ? 0 : 1) ? html`<span class="flag sup ready" title="Wins speed ties this round; goes first wherever there's an order">Initiative</span>` : null}
        ${now.map(s => html`<span class="flag status" title="This round">${s}</span>`)}
        ${next.map(s => html`<span class="flag status next" title="Next round">Next: ${s}</span>`)}
        ${sup && !m.G.rules.tableCards ? html`<span class=${cx('flag sup', superReady(X, m.G.rules) && 'ready', m.G.rules.superUses > 0 && X.supersUsed >= m.G.rules.superUses && 'spent')} title=${`${sup.name}: ${sup.meter} meter`}>${sup.name} ${superReady(X, m.G.rules) ? 'ready' : m.G.rules.superUses > 0 && X.supersUsed >= m.G.rules.superUses ? 'used' : `${Math.min(X.meter, sup.meter)}/${sup.meter}`}</span>` : null}
      </span>
    </div>
    <${LifeBar} X=${X} />
    <div class="hud-row">
      <div class="pile"><span class="label">Grey</span><span class="pile-n">${X.pile}</span><${Tokens} n=${X.pile} /></div>
      <div class="meter" aria-label=${`Meter ${X.meter} of ${m.G.rules.meterMax}`}><span class="label">Meter</span>${Array.from({ length: m.G.rules.meterMax }, (_, i) => html`<span class=${cx('pipm', i < X.meter && 'on')}></span>`)}</div>
    </div>
    <div class="hud-row small">
      <span class="count"><b>${X.hand.length}</b> in hand</span>
      ${cap !== null ? html`<span class="flag status" title=${`${Y.f.cards[Y.inPlay].name}: discard down to ${cap} in the draw step`}>Hand limit ${cap}</span>` : null}
      <span class=${cx('count', m.G.rules.timeout && X.deck.length <= 3 && 'flag status')} title=${m.G.rules.timeout ? 'No reshuffle: when a deck runs out, the game times out and the higher HP wins' : ''}><b>${X.deck.length}</b> in deck${m.G.rules.timeout && X.deck.length <= 3 ? ' · time-out near' : ''}</span>
      <span class="count"><b>${X.discard.length}</b> discarded${top ? html`<span class="muted"> · top: ${top.burned ? 'a burned card' : X.f.cards[top.i].name}</span>` : null}</span>
      ${X.reshuffles ? html`<span class="count muted">reshuffled ${X.reshuffles}×</span>` : null}
    </div>
    ${X.table ? html`<div class="hud-row small neutral-row" aria-label="On the table">
      <span class="label">Table</span>
      ${X.f.cards.map((c, i) => (c.special ? html`<span class=${cx('flag', X.table.includes(i) ? 'status' : 'sup')} title=${X.table.includes(i) ? `Read can take it for ${c.meter} meter` : m.G.rules.specialsReturn ? 'Taken: in their hand, back to the table once it leaves it' : 'Taken: in their deck for the game'}>${c.name} ${X.table.includes(i) ? `· ${c.meter} meter` : m.G.rules.specialsReturn ? '· in hand' : '· taken'}</span>` : null))}
      ${sup ? html`<span class=${cx('flag sup', X.superAt === 'hand' && 'ready', X.superAt === 'gone' && 'spent')} title="Their Super: taken from the table by Read, used once">${sup.name} ${X.superAt === 'table' ? `· ${sup.meter} meter` : X.superAt === 'hand' ? '· in hand' : '· used'}</span>` : null}
    </div>` : null}
    ${X.nhand ? html`<div class="hud-row small neutral-row">
      ${X.inPlay != null ? html`<span class="flag status" title=${X.f.cards[X.inPlay].src ? '' : ''}>In play: ${X.f.cards[X.inPlay].name}</span>` : null}
      <span class="count"><b>${X.nhand.length}</b> neutral in hand</span>
      <span class="count"><b>${X.ndeck.length}</b> in neutral deck</span>
      <span class="count"><b>${X.ndiscard.length}</b> neutral discarded${X.ndiscard.length ? html`<span class="muted"> · top: ${X.f.cards[X.ndiscard[X.ndiscard.length - 1]].name}</span>` : null}</span>
    </div>` : null}
  </section>`
}

function Stage16({ m, names, prefs }) {
  const G = m.G
  const shown = m.last && (m.phase === 'reveal' || m.phase === 'over')
  const neutral = shown ? m.last.neutral : m.phase === 'option' ? m.acts.map((a, k) => (a?.kind === 'neutral' ? { kind: 'neutral', name: P16(m, { ...a, side: k }).name, pending: true } : a ? a : { kind: 'none' })) : G.neutral
  const clash = shown ? m.last.clash : (m.phase === 'stage' || (m.phase === 'confiscate' && m.confNext === 'finish') ? G.clash : null)
  const res = m.result
  return html`<section class="clash" aria-label="The round" aria-live="polite">
    ${m.phase === 'over' ? html`<div class="outcome">
      <span class="ko">${m.timedOut ? 'Time' : res === 0.5 ? 'Draw' : 'K.O.'}</span>
      <b>${m.timedOut ? (res === 0.5 ? 'Time-out: level on HP, a draw' : `Time-out: ${names[res === 1 ? 0 : 1]} wins on HP`) : res === 0.5 ? 'Round limit reached' : `${names[res === 1 ? 0 : 1]} wins`}</b>
      <span>Round ${G.round}.${m.timedOut ? ` A deck ran out: ${G.A.hp} HP to ${G.B.hp}.` : ''}</span>
    </div>` : null}
    <span class="label">Round ${G.round} · ${{ neutral: 'Neutral phase', clash: 'Clash', stage: 'Clash', reveal: 'Result', discard: 'Draw phase', over: 'Result', confiscate: m.confNext === 'clash' ? 'Before the clash' : 'Clash', option: 'Neutral reveal', rider: 'Reveal' }[m.phase]}</span>
    ${neutral ? html`<div class="neutral-line">${[1, 0].map(k => html`<div><b>${names[k]}</b> <span>${neutralLine16(neutral[k], m.G[k === 0 ? 'A' : 'B'].f)}</span></div>`)}</div>` : null}
    ${m.phase === 'rider' ? html`<div class="clash-cards">
      ${[1, 0].map((k, n) => { const X = k === 0 ? G.A : G.B, i = m.picks[k]; return html`${n ? html`<span class="vs">VS</span>` : null}${i === null || i === undefined ? html`<div class="card card-back" style=${{ opacity: 0.4 }}><span>—</span></div>` : html`<${Card16} card=${card16(X, i).src} isSuper=${i === 'S'} />`}` })}
    </div>
    <p class="small muted">Both cards are face up. Riders fire now, the initiative holder's first; a Read or a Recall is chosen in that order.</p>
    ${m.opts.some((o, k) => o !== undefined && m.riderDone[k]) ? html`<ul class="narr16">${[0, 1].filter(k => m.opts[k] !== undefined && m.riderDone[k]).map(k => html`<li>${names[k]} chose: ${M.riderList(m, k).find(o => JSON.stringify(o.opt) === JSON.stringify(m.opts[k]))?.label || 'the default'}.</li>`)}</ul>` : null}`
    : !clash ? html`<div class="clash-cards">
      ${[1, 0].map((k, n) => html`${n ? html`<span class="vs">VS</span>` : null}<div class="card card-back" style=${{ opacity: (m.phase === 'clash' && m.picks[k] !== undefined) ? 1 : 0.35 }}><span>${m.phase === 'clash' && m.picks[k] !== undefined ? 'YOMI' : '?'}</span></div>`)}
    </div>
    <p class="small muted">${m.phase === 'neutral' ? 'Both neutral actions reveal together, then both clash cards.' : m.phase === 'clash' ? (m.G.rules.merged ? 'Both clash cards reveal together; their riders fire win or lose.' : 'Both clash cards reveal together.') : m.phase === 'discard' ? 'Drawing: over the hand limit, so a discard first.' : m.phase === 'confiscate' ? 'Confiscate: a discard before the clash cards are chosen.' : m.phase === 'option' ? 'Neutral cards revealed: options are chosen in initiative order.' : ''}</p>` : html`<${ClashView} m=${m} clash=${clash} names=${names} prefs=${prefs} />`}
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
  const lines = [...M.riderLines(clash, names), ...narrate16(clash.events, names)]
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
    ${m.phase === 'confiscate' ? html`<p class="followup-ask">${m.mode === 'ai' && m.turn === 0 ? 'You' : names[m.turn]} must discard to Confiscate.</p>` : null}
    ${m.phase === 'stage' ? html`<p class="followup-ask">${m.mode === 'ai' && m.turn === 0 ? 'You' : names[m.turn]} ${m.G.pending.stage === 'follow' ? 'may follow up with a Counter' : m.G.pending.twin ? 'may play the second Twin, then an Ender' : m.G.pending.stage === 'link' ? 'may combo: a Linker, then an Ender' : 'may end the combo with an Ender'}.</p>` : null}
    <ul class="narr16">${lines.map(l => html`<li>${l}</li>`)}</ul>
    ${prefs.odds && last?.mix && m.phase !== 'stage' ? html`<div class="mix">
      <span class="label">The sparring partner's mix this round</span>
      ${[1, 0].map(k => last.mix[k] ? html`<span class="small">${names[k]}: ${last.mix[k].filter(([, p]) => p >= 0.01).sort((a, b) => b[1] - a[1]).map(([n, p]) => `${n} ${Math.round(p * 100)}%`).join(', ')}</span>` : null)}
    </div>` : null}`
}

// A deck's size, as clash and neutral cards
const oneDeckSize = f => { const sp = (f.cards || []).filter(c => c.special).length; return `${deckSize(f) - sp} cards${sp ? ` + ${sp} specials` : ''}` }
const splitSize = f => { const all = deckSize(f), n = (f.cards || []).filter(c => c.type === 'neutral').reduce((t, c) => t + (c.copies || 0), 0), sp = (f.cards || []).filter(c => c.special).length; return `${all - n - sp} clash + ${n} neutral cards${sp ? ` + ${sp} specials` : ''}` }

const P16 = (m, a) => (a.side === 1 ? m.G.B : m.G.A).f.cards[a.i] || { name: '?' }
export const tieRule = R => (R.speedTie === 'initiative' ? 'go to the initiative holder' : R.speedTie === 'lowhp' ? 'go to the player on less HP' : 'cancel')

// The draw step's grey, in words ('' when off)
export const greyRule = R => (R.greyPerRound ?? 0) > 0 ? `; each player takes ${R.greyPerRound} grey with their draw` : ''

// The neutral step's options, in words
export const neutralRule = R => R.merged
  ? 'one step a round: a clash card each, its On reveal rider firing win or lose'
  : R.splitDecks
  ? `split decks: play one of your ${R.neutralHand ?? 3} neutral cards each neutral step, and a clash card if you have one you can play`
  : R.focusDraw
  ? `neutral step: a neutral card, or Focus (draw a card${(R.focusMeter ?? 0) > 0 ? ` and gain ${R.focusMeter} meter` : ''})${(R.burnMax ?? 0) > 0 ? `, or burn up to ${R.burnMax}` : ''}`
  : `neutral step: a neutral card, the Breather (draw a card)${(R.focusMeter ?? 0) > 0 ? `, or Focus (gain ${R.focusMeter} meter)` : ''}${(R.burnMax ?? 0) > 0 ? `, or burn up to ${R.burnMax}` : ''}`

// ---- what the deciding player does --------------------------------------------------
function Action16({ m, setM, side, prefs, names, who }) {
  const X = side === 0 ? m.G.A : m.G.B
  const [sel, setSel] = useState(null)
  const [burn, setBurn] = useState(null)        // null, or the hand positions picked to burn
  const [disc, setDisc] = useState([])          // hand positions picked to discard down to the limit
  useEffect(() => { setSel(null); setBurn(null); setDisc([]) }, [m.phase, m.G.round, m.turn, m.G.pending?.stage])
  const youName = m.mode === 'ai' ? 'Your' : `${who[side]}'s`
  const notes = prefs.hints !== false && (m.phase === 'clash' || m.phase === 'neutral') ? M.boardNotes16(m, side) : []
  const Notes = notes.length ? html`<ul class="notes" aria-label="Board notes">${notes.map(n => html`<li class=${n.tone || ''}>${n.text}</li>`)}</ul>` : null

  if (m.phase === 'neutral') {
    const R = m.G.rules
    const o = neutralOptions16(X, R)
    const groups = M.handGroups(X, burn ? null : new Set(o.neutrals))
    if (burn) {
      const hand = X.hand.map((i, pos) => ({ i, pos, c: X.f.cards[i] }))
      const toggle = pos => setBurn(b => (b.includes(pos) ? b.filter(p => p !== pos) : b.length < o.maxBurn ? [...b, pos] : b))
      return html`<div class="spread"><h3>${youName} neutral action · burn for meter</h3>
        <div class="actions">
          <button class="btn" disabled=${!burn.length} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'burn', cards: burn.map(p => X.hand[p]) }))}>Burn ${burn.length || ''}</button>
          <button class="btn ghost" onClick=${() => setBurn(null)}>Back</button>
        </div></div>
        <p class="small">Pick up to ${o.maxBurn} card${o.maxBurn > 1 ? 's' : ''}: 1 meter each (you have ${X.meter} of ${R.meterMax}). They go face down under your discard pile; the opponent sees how many, not which.</p>
        <div class="hand">${hand.map(h => html`<div key=${h.pos}><${Card16} as="button" card=${h.c.src} cls=${cx(burn.includes(h.pos) && 'selected')} onClick=${() => toggle(h.pos)} /></div>`)}</div>`
    }
    const full = X.meter >= (R.meterMax ?? 4)
    if (o.split) {
      const ng = M.handGroups(X, new Set(o.neutrals), null, X.nhand)
      const clashGroups = M.handGroups(X)
      return html`<div class="spread"><h3>${youName} neutral card · Round ${m.G.round}</h3>
          <div class="actions"><button class="btn" disabled=${sel === null} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'neutral', i: sel }))}>Play ${sel !== null && typeof sel === 'number' ? X.f.cards[sel].name : 'a neutral card'}</button></div></div>
        ${Notes}
        <p class="small muted">Pick one of your neutral cards. Meter ${X.meter} of ${R.meterMax ?? 4}${full ? ' (full)' : ''}.</p>
        <div class="hand neutral-hand">${ng.map(g => html`<div key=${'n' + g.i}><${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} cls=${cx(sel === g.i && 'selected')} onClick=${() => setSel(g.i)} /></div>`)}</div>
        <span class="label">Your clash hand · ${X.hand.length}</span>
        <div class="hand small-hand">${clashGroups.map(g => html`<div key=${'c' + g.i}><${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} /></div>`)}</div>`
    }
    return html`<div class="spread"><h3>${youName} neutral action · Round ${m.G.round}</h3></div>
      ${Notes}
      <div class="actions">
        ${R.focusDraw
          ? html`<button class="btn" onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'focus' }))}>Focus: draw${full ? '' : ' + 1 meter'}</button>`
          : html`<button class="btn" onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'draw' }))}>Breather: draw a card</button>
            ${(R.focusMeter ?? 0) > 0 ? html`<button class="btn ghost" disabled=${!o.canFocus} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'focus' }))}>Focus: +1 meter</button>` : null}`}
        ${o.maxBurn || (R.burnMax ?? 0) > 0 ? html`<button class="btn ghost" disabled=${!o.maxBurn} onClick=${() => setBurn([])}>Burn for meter…</button>` : null}
        <button class="btn ghost" disabled=${sel === null} onClick=${() => setM(M.chooseNeutral(m, side, { kind: 'neutral', i: sel }))}>Play ${sel !== null ? X.f.cards[sel].name : 'a neutral card'}</button>
      </div>
      <p class="small muted">${o.neutrals.length ? 'To play a neutral card, pick it below.' : 'You hold no neutral cards.'} ${full ? 'Your meter is full.' : `Meter ${X.meter} of ${R.meterMax ?? 4}.`}</p>
      <div class="hand">${groups.map(g => html`<div key=${g.i}>${g.c.t === 'N'
        ? html`<${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} cls=${cx(sel === g.i && 'selected')} onClick=${() => setSel(g.i)} />`
        : html`<${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} />`}</div>`)}</div>`
  }

  if (m.phase === 'clash') {
    const ok = M.clashSet(m, side)
    const groups = M.handGroups(X, ok, M.clashWhy(X))
    const sup = X.f.sup
    return html`<div class="spread"><h3>${youName} clash card · Round ${m.G.round}</h3>
        <div class="actions"><button class="btn" disabled=${sel === null} onClick=${() => setM(M.choosePick(m, side, sel))}>Lock in</button>
          ${m.G.rules.blankClash !== false && !(m.G.rules.merged && m.G.rules.blankClash !== true) ? html`<button class="btn ghost" onClick=${() => setM(M.choosePick(m, side, null))}>Play nothing (Focus)</button>` : null}</div></div>
      ${Notes}
      <div class="hand">
        ${groups.map(g => html`<div key=${g.i}><${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} disabled=${!g.ok} why=${g.why}
          stamp=${g.ok && X.st.lock?.[g.c.t] ? 'Locked: voided' : null}
          cls=${cx(!g.ok && 'off', sel === g.i && 'selected')} onClick=${() => g.ok && setSel(g.i)} /></div>`)}
        ${sup && (!m.G.rules.tableCards || X.superAt === 'hand') ? html`<div key="S"><${Card16} as="button" card=${sup.src} isSuper=${true} disabled=${!ok.has('S')} why=${ok.has('S') ? null : `${X.meter} of ${sup.meter} meter`}
          cls=${cx(!ok.has('S') && 'off', sel === 'S' && 'selected')} onClick=${() => ok.has('S') && setSel('S')} /></div>` : null}
      </div>`
  }

  if (m.phase === 'stage') {
    const p = m.G.pending
    const ok = new Set(p.options)
    const groups = M.handGroups(X, ok, () => (p.twin ? 'Only the second copy can follow' : { follow: 'Not a Counter', link: 'Not a Linker', end: 'Not an Ender' }[p.stage]))
    const sup = X.f.sup
    const what = p.twin ? 'Twin: play the second copy as another Linker' : { follow: 'Follow up with a Counter', link: 'Combo: play a Linker', end: 'End the combo: play an Ender' }[p.stage]
    return html`<div class="spread"><h3>${what}</h3>
        <div class="actions">
          <button class="btn" disabled=${sel === null} onClick=${() => setM(M.chooseStage(m, sel))}>Play it</button>
          <button class="btn ghost" onClick=${() => setM(M.chooseStage(m, null))}>${p.twin ? 'No second Linker' : p.stage === 'link' ? 'Skip the Linker' : p.stage === 'end' ? 'No Ender' : 'No follow-up'}</button>
        </div></div>
      <p class="small">${p.twin ? 'Twin: a second copy of the Linker you just played lands unopposed too, then you may end with an Ender. It costs you another card.' : p.stage === 'follow' ? 'Your Guard beat their Pressure: one Counter from your hand lands unopposed. It never starts a combo.' : p.stage === 'link' ? 'Your Starter landed. A Linker lands unopposed, then you may end with an Ender. Skip the Linker to go straight to the Ender.' : 'An Ender lands unopposed and ends the combo: a Convert cashes the whole pile, a status Ender leaves them loaded.'}</p>
      <div class="hand">
        ${groups.map(g => html`<div key=${g.i}><${Card16} as="button" card=${g.c.src} count=${g.n > 1 ? g.n : null} disabled=${!g.ok} why=${g.why}
          stamp=${g.ok && X.st.lock?.[g.c.t] ? 'Locked: voided' : null}
          cls=${cx(!g.ok && 'off', sel === g.i && 'selected')} onClick=${() => g.ok && setSel(g.i)} /></div>`)}
        ${sup && ok.has('S') ? html`<div key="S"><${Card16} as="button" card=${sup.src} isSuper=${true} cls=${cx(sel === 'S' && 'selected')} onClick=${() => setSel('S')} /></div>` : null}
      </div>`
  }

  if (m.phase === 'discard') {
    const need = m.G.discardDown[side]
    const [pick, setPick] = [disc, setDisc]
    const hand = X.hand.map((i, pos) => ({ i, pos, c: X.f.cards[i] }))
    const toggle = pos => setPick(pick.includes(pos) ? pick.filter(p => p !== pos) : pick.length < need ? [...pick, pos] : pick)
    const lim = handLimitOf(X, side === 0 ? m.G.B : m.G.A, m.G.rules)
    const Y = side === 0 ? m.G.B : m.G.A
    return html`<div class="spread"><h3>Discard down to ${lim}</h3>
        <div class="actions"><button class="btn" disabled=${pick.length !== need} onClick=${() => setM(M.chooseDiscard(m, side, pick.map(p => X.hand[p])))}>Discard ${need}</button></div></div>
      <p class="small">You're over the hand limit${lim < (m.G.rules.handLimit ?? 8) ? ` (${lim}, under their ${Y.f.cards[Y.inPlay].name})` : ''}: pick ${need} card${need > 1 ? 's' : ''} to discard (face up).</p>
      <div class="hand">${hand.map(h => html`<div key=${h.pos}><${Card16} as="button" card=${h.c.src} cls=${cx(pick.includes(h.pos) && 'selected')} onClick=${() => toggle(h.pos)} /></div>`)}</div>`
  }
  if (m.phase === 'option') {
    const list = M.optionList(m, side)
    const c = X.f.cards[m.acts[side].i]
    return html`<div class="spread"><h3>${c.name}: choose</h3></div>
      <p class="small">Both neutral cards are revealed. ${m.G.init === side ? 'You hold the initiative, so you choose first.' : 'Your opponent chose first (they hold the initiative).'} Meter ${X.meter} of ${m.G.rules.meterMax}.</p>
      <div class="actions">${list.map((o, n) => html`<button class=${cx('btn', n && 'ghost')} onClick=${() => setM(M.chooseOption(m, side, o.opt))}>${o.label}</button>`)}</div>
      ${list.some(o => o.card) ? html`<div class="hand">${list.filter(o => o.card).map(o => html`<div><${Card16} card=${o.card.src} isSuper=${!!o.sup} /></div>`)}</div>` : null}`
  }
  if (m.phase === 'rider') {
    const list = M.riderList(m, side)
    const c = M.riderCard(m, side)
    return html`<div class="spread"><h3>${c.name}: ${c.reveal.read ? 'Read' : 'Recall'}</h3></div>
      <p class="small">Both clash cards are face up. ${m.G.init === side ? 'You hold the initiative, so you choose first.' : 'Your opponent chose first (they hold the initiative).'} ${c.reveal.read ? `Meter ${X.meter} of ${m.G.rules.meterMax}. A card you take is yours at once: it can be your follow-up this round.` : 'The card comes back from your face-up discard pile, so your opponent knows you hold it. It can be your follow-up this round.'}</p>
      <div class="actions">${list.filter(o => !o.card).map(o => html`<button class="btn" onClick=${() => setM(M.chooseRider(m, side, o.opt))}>${o.label}</button>`)}</div>
      ${list.some(o => o.card) ? html`<div class="hand">${list.filter(o => o.card).map(o => html`<div class="stack" style=${{ gap: '6px', justifyItems: 'center' }}><${Card16} as="button" card=${o.card.src} isSuper=${!!o.sup} onClick=${() => setM(M.chooseRider(m, side, o.opt))} /><span class="small">${o.label}</span></div>`)}</div>` : null}`
  }
  if (m.phase === 'confiscate') {
    const need = X.owe || 0
    const [pick, setPick] = [disc, setDisc]
    const hand = X.hand.map((i, pos) => ({ i, pos, c: X.f.cards[i] }))
    const toggle = pos => setPick(pick.includes(pos) ? pick.filter(p => p !== pos) : pick.length < need ? [...pick, pos] : pick)
    const src = M.confiscateSource(m, side)
    return html`<div class="spread"><h3>Confiscate: discard ${need}</h3>
        <div class="actions"><button class="btn" disabled=${pick.length !== need} onClick=${() => setM(M.chooseConfiscated(m, side, pick.map(p => X.hand[p])))}>Discard ${need}</button></div></div>
      <p class="small">Their ${src} ${m.confNext === 'clash' ? 'takes a card before the clash' : 'took cards'}: pick ${need} clash card${need > 1 ? 's' : ''} to discard, face up. ${CONFISCATE_LINE}</p>
      <div class="hand">${hand.map(h => html`<div key=${h.pos}><${Card16} as="button" card=${h.c.src} cls=${cx(pick.includes(h.pos) && 'selected')} onClick=${() => toggle(h.pos)} /></div>`)}</div>`
  }
  return null
}

function HandView({ X, title }) {
  const groups = M.handGroups(X)
  const ng = X.nhand ? M.handGroups(X, null, null, X.nhand) : []
  return html`<div class="stack" style=${{ gap: '8px' }}>
    <span class="label">${title} · ${X.hand.length}</span>
    <div class="hand">${groups.map(g => html`<div key=${g.i}><${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} /></div>`)}</div>
    ${X.nhand ? html`<span class="label">Neutral · ${X.nhand.length}</span>
    <div class="hand">${ng.map(g => html`<div key=${'n' + g.i}><${Card16} card=${g.c.src} count=${g.n > 1 ? g.n : null} /></div>`)}</div>` : null}
  </div>`
}

function RoundLog16({ m, names }) {
  if (!m.history.length) return html`<div class="panel stack"><h3>Rounds</h3><p class="small muted">Each round's neutral actions, cards and the board after it appear here.</p></div>`
  const nl = a => ({ draw: 'drew', focus: 'focus', neutral: `${a.name}${a.took ? ` (took ${a.took})` : a.fetched ? ` (fetched ${a.fetched})` : ''}`, burn: `burned ${a.n}`, none: '—', skip: a.why ? a.why.toLowerCase() : 'skipped' })[a.kind] || a.kind
  return html`<div class="panel stack">
    <h3>Rounds</h3>
    <div class="log">
      ${[...m.history].reverse().map(r => html`<div class="log-row" key=${r.n}>
        <b>${r.n}</b>
        <div>
          ${r.reveals ? (r.reveals.length ? html`<div class="small muted">${M.riderLines({ events: r.reveals }, names).join(' ')}</div>` : null) : html`<div class="small muted">Neutral: ${names[0]} ${nl(r.neutral[0])} · ${names[1]} ${nl(r.neutral[1])}</div>`}
          <div class="vsline"><span class="tdot" data-t=${r.types[0] || 'T'}></span>${r.cards[0] || 'nothing'} <span class="muted">vs</span> <span class="tdot" data-t=${r.types[1] || 'T'}></span>${r.cards[1] || 'nothing'}
            ${r.follow ? html`<span class="muted">· follow-up:</span> ${r.follow.name}` : null}
            ${r.combo.length ? html`<span class="muted">· combo:</span> ${r.combo.map(x => x.name).join(' → ')}` : null}</div>
          ${r.confiscated?.some(a => a.length) ? html`<div class="small muted">Confiscated: ${[0, 1].filter(k => r.confiscated[k].length).map(k => `${names[k]} ${r.confiscated[k].join(', ')}`).join(' · ')}</div>` : null}
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
  if (X.nhand) {
    for (const i of X.nhand) n[i].hand++
    for (const i of X.ndeck) n[i].deck++
    for (const i of [...X.ndiscard, ...X.nused]) n[i].discard++
    if (X.inPlay != null) n[X.inPlay].discard++
  }
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
