// Playtest log: every finished game with a person in it.

import { html, useState, useMemo, pct } from './lib.js'
import { getState, deleteGame, download, roster } from './store.js'
import { Confirm, Seg, toast, copyText } from './ui.js'
import { TYPE_LABEL } from '../engine/keywords.js'
import { LEVELS } from '../engine/ai.js'

// Games logged before difficulty existed were all against Hard
const levelOf = g => (g.mode === 'ai' ? g.levels?.[1] || 'hard' : null)

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
const when = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Log() {
  const st = getState()
  const [mode, setMode] = useState('all')
  const [ask, setAsk] = useState(null)
  const games = st.games.filter(g => mode === 'all' || g.mode === mode)
  const current = useMemo(() => Object.fromEntries(roster().map(r => [r.id, r])), [st.docs])
  const s = useMemo(() => summarise(games), [games])

  if (!st.gamesLoaded) return html`<div class="stack"><h1>Playtest log</h1><p class="muted">Loading the log…</p></div>`
  return html`<div class="stack" style=${{ gap: '24px' }}>
    <div class="spread">
      <div class="stack"><h1>Playtest log</h1>
        <p class="lede">Games played by people, at the table or against the sparring partner. Each one keeps the exact cards and settings it was played with.</p></div>
      <${Seg} value=${mode} onChange=${setMode} label="Which games" options=${[['all', 'All'], ['ai', 'Vs sparring partner'], ['hotseat', 'Two players']]} />
    </div>
    ${!games.length ? html`<div class="panel stack"><h3>No games yet</h3><p class="muted">Finish a match on the Play tab and it appears here: who won, how, round by round, and which cards people chose.</p></div>` : html`
      <div class="stats">
        <div class="stat-tile"><span class="label">Games</span><b>${games.length}</b></div>
        <div class="stat-tile"><span class="label">Median length</span><b>${s.median ?? '–'}</b><span class="small muted">rounds</span></div>
        <div class="stat-tile"><span class="label">Double KOs</span><b>${pct(s.dko / games.length, 0)}</b><span class="small muted">${s.draws} drawn</span></div>
        <div class="stat-tile"><span class="label">Quiet rounds</span><b>${pct(s.quiet / Math.max(s.rounds, 1), 1)}</b><span class="small muted">no HP or pile change</span></div>
        <div class="stat-tile"><span class="label">Without a type</span><b>${pct(s.locked / Math.max(s.seats, 1), 1)}</b><span class="small muted">of player-rounds</span></div>
      </div>
      <div class="pickers">
        <div class="panel stack"><h3>Fighters</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fighter</th><th class="r">Games</th><th class="r">Won</th><th class="r">Win rate</th></tr></thead>
          <tbody>${Object.entries(s.fighters).sort((a, b) => b[1].games - a[1].games).map(([name, f]) => html`<tr><td>${name}</td><td class="r">${f.games}</td><td class="r">${f.wins}</td><td class="r">${pct(f.wins / f.games)}</td></tr>`)}</tbody></table></div>
          <p class="small muted">Draws count as half a win. Mirrors count once per seat.</p>
        </div>
        ${s.vsPartner.length ? html`<div class="panel stack"><h3>Your record against the sparring partner</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Difficulty</th><th class="r">Games</th><th class="r">Won</th><th class="r">Win rate</th></tr></thead>
          <tbody>${s.vsPartner.map(([lvl, r]) => html`<tr><td>${LEVELS[lvl]?.label || lvl}</td><td class="r">${r.games}</td><td class="r">${r.wins}</td><td class="r">${pct(r.wins / r.games)}</td></tr>`)}</tbody></table></div>
          <p class="small muted">Small samples swing a lot: over 5 games, an evenly matched player wins anywhere from 1 to 4 nearly every time.</p>
        </div>` : null}
        <div class="panel stack"><h3>How games end</h3>
          <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(s.routes).sort((a, b) => b[1] - a[1]).map(([r, c]) => html`<tr><td>${r}</td><td class="r">${c}</td><td class="r">${pct(c / games.length)}</td></tr>`)}</tbody></table></div>
        </div>
      </div>
      <div class="panel stack"><h3>What people played</h3>
        <p class="small muted">Picks made by people only, not the sparring partner. Resolved means it won, mirrored or met a typeless card.</p>
        <div class="pickers">${Object.entries(s.cards).map(([fname, cards]) => {
          const tot = Object.values(cards).reduce((x, y) => x + y.plays, 0)
          return html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${fname}</th><th class="r">Plays</th><th class="r">Share</th><th class="r">Resolved</th></tr></thead>
            <tbody>${Object.entries(cards).sort((a, b) => b[1].plays - a[1].plays).map(([c, v]) => html`<tr><td><span class="tdot" data-t=${v.t}></span> ${c}</td><td class="r">${v.plays}</td><td class="r">${pct(v.plays / tot)}</td><td class="r">${pct(v.resolved / v.plays)}</td></tr>`)}</tbody></table></div>`
        })}</div>
      </div>
      <section class="stack">
        <div class="spread"><h2>Games</h2>
          <div class="row">
            <button class="link" onClick=${() => download(`yomi-playtest-log.json`, JSON.stringify(games, null, 1)).catch(e => toast(e.message))}>Download the log</button>
            <button class="link" onClick=${() => copyText(JSON.stringify(games, null, 1))}>Copy as JSON</button>
          </div>
        </div>
        ${ask ? html`<${Confirm} text="Delete this game from the log?" yes="Delete" onNo=${() => setAsk(null)}
          onYes=${() => { const id = ask; setAsk(null); deleteGame(id).then(() => toast('Deleted'), e => toast(e.message)) }} />` : null}
        <div>${games.map(g => html`<${GameRow} key=${g.id} g=${g} current=${current} onDelete=${() => setAsk(g.id)} canDelete=${st.canWrite !== false} />`)}</div>
      </section>`}
  </div>`
}

function GameRow({ g, current, onDelete, canDelete }) {
  const [open, setOpen] = useState(false)
  const [a, b] = g.fighters
  const winner = g.result === 1 ? a.name : g.result === 0 ? b.name : null
  const tag = f => {
    const cur = current[f.id]
    if (!cur) return ' (deleted variant)'
    if (f.status === 'edited') return ' (edited)'
    if (cur.hash !== f.hash) return ' (older version)'
    return ''
  }
  return html`<div class="game-row">
    <div class="stack" style=${{ gap: '2px' }}>
      <strong>${a.name}${tag(a)} vs ${b.name}${tag(b)}</strong>
      <span class="small muted">${when(g.finishedAt)} · ${g.mode === 'ai' ? `vs sparring partner on ${LEVELS[levelOf(g)]?.label || levelOf(g)} (you were ${a.name})` : 'two players'} · ${g.rounds.length} rounds · ${winner ? `${winner} won` : 'draw'} by ${g.route}</span>
    </div>
    <div class="row">
      <button class="link" onClick=${() => setOpen(!open)}>${open ? 'Hide rounds' : 'Rounds'}</button>
      ${canDelete ? html`<button class="link" onClick=${onDelete}>Delete</button>` : null}
    </div>
    ${open ? html`<div class="tbl-wrap" style=${{ gridColumn: '1 / -1' }}><table class="tbl">
      <thead><tr><th>#</th><th>${a.name}</th><th>${b.name}</th><th>Outcome</th><th class="r">${a.name} HP · grey</th><th class="r">${b.name} HP · grey</th></tr></thead>
      <tbody>${g.rounds.map(r => html`<tr>
        <td>${r.n}</td>
        <td><span class="tdot" data-t=${r.types[0]}></span> ${r.cards[0]}${r.lockedOut[0] ? ' ·' : ''}</td>
        <td><span class="tdot" data-t=${r.types[1]}></span> ${r.cards[1]}${r.lockedOut[1] ? ' ·' : ''}</td>
        <td>${r.outcome === 'A' ? `${TYPE_LABEL[r.types[0]]} wins` : r.outcome === 'B' ? `${TYPE_LABEL[r.types[1]]} wins` : r.outcome === 'mirror' ? 'Mirror' : 'Typeless'}</td>
        <td class="r num">${r.after[0].hp} · ${r.after[0].pile}</td>
        <td class="r num">${r.after[1].hp} · ${r.after[1].pile}</td>
      </tr>`)}</tbody>
    </table><p class="small muted" style=${{ marginTop: '6px' }}>A dot after a card means that player was without a type that round.</p></div>` : null}
  </div>`
}

function summarise(games) {
  const s = { dko: 0, draws: 0, rounds: 0, quiet: 0, locked: 0, seats: 0, lengths: [], routes: {}, fighters: {}, cards: {}, vsPartner: [] }
  const vp = {}
  for (const g of games) {
    if (g.mode === 'ai') { const r = (vp[levelOf(g)] ??= { games: 0, wins: 0 }); r.games++; r.wins += g.result }
    s.lengths.push(g.rounds.length)
    s.routes[g.route] = (s.routes[g.route] || 0) + 1
    const last = g.rounds[g.rounds.length - 1]
    if (last && last.after[0].hp <= 0 && last.after[1].hp <= 0) { s.dko++; if (g.result === 0.5) s.draws++ }
    g.fighters.forEach((f, k) => {
      const F = (s.fighters[f.name] ??= { games: 0, wins: 0 })
      F.games++; F.wins += k === 0 ? g.result : 1 - g.result
    })
    for (const r of g.rounds) {
      s.rounds++; if (r.quiet) s.quiet++
      for (const k of [0, 1]) {
        s.seats++; if (r.lockedOut[k]) s.locked++
        if (!g.humans[k]) continue
        const C = (s.cards[g.fighters[k].name] ??= {})
        const c = (C[r.cards[k]] ??= { plays: 0, resolved: 0, t: r.types[k] })
        c.plays++; if (r.resolved[k]) c.resolved++
      }
    }
  }
  s.median = median(s.lengths)
  s.vsPartner = Object.keys(LEVELS).filter(k => vp[k]).map(k => [k, vp[k]])
  return s
}
