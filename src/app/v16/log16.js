// Playtest log (rules v16): every finished game with a person in it.

import { html, useState, useMemo, pct } from '../lib.js'
import { getState, deleteGame, download } from '../store.js'
import { Confirm, Seg, toast, copyText } from '../ui.js'
import { LEVELS16 } from '../../engine/v16/ai.js'

const when = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }

function summarise(games) {
  const S = { routes: {}, lengths: [], fighters: {}, vsPartner: {}, neutral: {}, cards: {}, combos: 0, follows: 0, rounds: 0, seats: 0 }
  for (const g of games) {
    S.lengths.push(g.rounds.length)
    S.routes[g.route] = (S.routes[g.route] || 0) + 1
    g.fighters.forEach((f, k) => {
      const e = S.fighters[f.name] || (S.fighters[f.name] = { games: 0, wins: 0 })
      e.games++; e.wins += k === 0 ? g.result : 1 - g.result
    })
    if (g.mode === 'ai') { const lv = g.levels?.[1] || 'hard'; const e = S.vsPartner[lv] || (S.vsPartner[lv] = { games: 0, wins: 0 }); e.games++; e.wins += g.result }
    for (const r of g.rounds) {
      S.rounds++
      if (r.combo?.length) S.combos++
      if (r.follow) S.follows++
      g.humans.forEach((h, k) => {
        if (!h) return
        S.seats++
        const a = r.neutral[k]
        const key = a.kind === 'neutral' ? `played ${a.name}` : a.kind === 'burn' ? `burned ${a.n}` : a.kind
        S.neutral[key] = (S.neutral[key] || 0) + 1
        const fn = g.fighters[k].name
        const c = S.cards[fn] || (S.cards[fn] = {})
        if (r.cards[k]) c[r.cards[k]] = (c[r.cards[k]] || 0) + 1
      })
    }
  }
  S.median = median(S.lengths)
  return S
}

export function Log16() {
  const st = getState()
  const [mode, setMode] = useState('all')
  const [ask, setAsk] = useState(null)
  const [open, setOpen] = useState(null)
  const games = st.games.filter(g => g.rules === 16 && (mode === 'all' || g.mode === mode))
  const s = useMemo(() => summarise(games), [games])
  if (!st.gamesLoaded) return html`<div class="stack"><h1>Playtest log</h1><p class="muted">Loading the log…</p></div>`
  return html`<div class="stack" style=${{ gap: '24px' }}>
    <div class="spread">
      <div class="stack"><h1>Playtest log</h1><p class="lede">Games played by people, with the exact decks and settings they used, round by round.</p></div>
      <${Seg} value=${mode} onChange=${setMode} label="Which games" options=${[['all', 'All'], ['ai', 'Vs sparring partner'], ['hotseat', 'Two players']]} />
    </div>
    ${!games.length ? html`<div class="panel stack"><h3>No games yet</h3><p class="muted">Finish a match on the Play tab and it appears here.</p></div>` : html`
      <div class="stats">
        <div class="stat-tile"><span class="label">Games</span><b>${games.length}</b></div>
        <div class="stat-tile"><span class="label">Median length</span><b>${s.median ?? '–'}</b><span class="small muted">rounds</span></div>
        <div class="stat-tile"><span class="label">Combos</span><b>${pct(s.combos / Math.max(s.rounds, 1), 0)}</b><span class="small muted">of rounds</span></div>
        <div class="stat-tile"><span class="label">Follow-ups</span><b>${pct(s.follows / Math.max(s.rounds, 1), 0)}</b><span class="small muted">of rounds</span></div>
      </div>
      <div class="pickers">
        ${Object.keys(s.vsPartner).length ? html`<div class="panel stack"><h3>Your record against the partner</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Difficulty</th><th class="r">Games</th><th class="r">Win rate</th></tr></thead>
          <tbody>${Object.entries(s.vsPartner).map(([lv, r]) => html`<tr><td>${LEVELS16[lv]?.label || lv}</td><td class="r">${r.games}</td><td class="r">${pct(r.wins / r.games)}</td></tr>`)}</tbody></table></div></div>` : null}
        <div class="panel stack"><h3>How games end</h3>
          <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(s.routes).sort((a, b) => b[1] - a[1]).map(([r, c]) => html`<tr><td>${r}</td><td class="r">${c}</td><td class="r">${pct(c / games.length)}</td></tr>`)}</tbody></table></div></div>
        <div class="panel stack"><h3>People's neutral actions</h3>
          <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(s.neutral).sort((a, b) => b[1] - a[1]).map(([k, c]) => html`<tr><td>${k}</td><td class="r">${pct(c / Math.max(s.seats, 1))}</td></tr>`)}</tbody></table></div></div>
        ${Object.entries(s.cards).map(([fn, cards]) => { const tot = Object.values(cards).reduce((a, b) => a + b, 0); return html`<div class="panel stack"><h3>${fn}: people's clash cards</h3>
          <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(cards).sort((a, b) => b[1] - a[1]).map(([c, v]) => html`<tr><td>${c}</td><td class="r">${pct(v / tot)}</td></tr>`)}</tbody></table></div></div>` })}
      </div>
      <div class="panel stack"><h3>Games</h3>
        ${games.map(g => html`<div class="game-row" key=${g.id}>
          <div><b>${g.fighters[0].name} vs ${g.fighters[1].name}</b> <span class="small muted">· ${g.mode === 'ai' ? `vs ${LEVELS16[g.levels?.[1]]?.label || 'partner'}` : 'two players'} · ${when(g.finishedAt)}</span><br />
            <span class="small">${g.result === 0.5 ? 'Draw' : `${g.fighters[g.result === 1 ? 0 : 1].name}${g.fighters[0].name === g.fighters[1].name ? (g.result === 1 ? ' (1)' : ' (2)') : ''} won`} · ${g.route} · ${g.rounds.length} rounds</span></div>
          <div class="actions">
            <button class="link" onClick=${() => setOpen(open === g.id ? null : g.id)}>${open === g.id ? 'Hide' : 'Rounds'}</button>
            <button class="link" onClick=${() => copyText(JSON.stringify(g, null, 2))}>Copy</button>
            <button class="link" onClick=${() => setAsk(g.id)}>Delete</button>
          </div>
          ${open === g.id ? html`<div style=${{ gridColumn: '1 / -1' }} class="small stack">${g.rounds.map(r => html`<div>
            <b>${r.n}.</b> ${r.neutral.map(a => a.kind === 'neutral' ? a.name : a.kind === 'burn' ? `burn ${a.n}` : a.kind).join(' / ')} · ${r.cards[0] || 'nothing'} vs ${r.cards[1] || 'nothing'} (${r.outcome})${r.follow ? ` · follow-up ${r.follow.name}` : ''}${r.combo.length ? ` · combo ${r.combo.map(x => x.name).join(' → ')}` : ''}${r.statuses.some(x => x.length) ? ` · next: ${r.statuses.map(x => x.join(', ') || '—').join(' / ')}` : ''} · <span class="muted num">${r.after[0].hp}/${r.after[0].pile} — ${r.after[1].hp}/${r.after[1].pile}</span>
          </div>`)}</div>` : null}
        </div>`)}
      </div>
      <div class="actions"><button class="link" onClick=${() => download('yomi-v16-log.json', JSON.stringify(games, null, 2)).catch(e => toast(e.message))}>Download the log</button></div>`}
    ${ask ? html`<${Confirm} text="Delete this game from the log?" yes="Delete" onYes=${() => { const id = ask; setAsk(null); deleteGame(id).then(() => toast('Deleted'), e => toast(e.message)) }} onNo=${() => setAsk(null)} />` : null}
  </div>`
}
