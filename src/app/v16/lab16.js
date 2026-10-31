// Lab (rules v16): bulk games between sparring partners (or bots) on the
// current decks, edits included.

import { html, useState, useRef, pct } from '../lib.js'
import { roster } from '../store.js'
import { settings16, toFighter16 } from './fighters16.js'
import { runBalance16 } from '../../engine/v16/game.js'
import { LEVELS16, BOTS16 } from '../../engine/v16/ai.js'
import { Seg, StatusChip } from '../ui.js'

const SIZES = [[100, '100'], [300, '300'], [500, '500'], [1000, '1,000']]
const ALL_LEVELS = { ...LEVELS16, ...BOTS16 }
const share = (o, tot) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / Math.max(tot, 1))}`).join(', ')

export function Lab16({ state, setState }) {
  const list = roster().filter(r => r.rules === 16)
  const ids = list.map(r => r.id)
  const { a = ids[0], b = ids[0], n = 300, seed = 1, report = null, exploit = null, la = 'hard', lb = 'hard' } = state
  const [running, setRunning] = useState(null)
  const ctl = useRef(null)
  const upd = p => setState({ ...state, ...p })
  const s = settings16()
  const fighter = id => list.find(r => r.id === id)

  const one = async () => {
    const ra = fighter(a), rb = fighter(b)
    ctl.current = new AbortController()
    setRunning({ done: 0, n, label: `${ra.fighter.name} vs ${rb.fighter.name}` })
    const r = await runBalance16(toFighter16(ra.fighter), toFighter16(rb.fighter), { n, seed, rules: s.rules, W: s.ai, levels: [la, lb], signal: ctl.current.signal,
      onProgress: done => setRunning(x => x && { ...x, done }) })
    setRunning(null)
    upd({ report: { ...r, names: [ra.fighter.name, rb.fighter.name], statuses: [ra.status, rb.status], levels: [la, lb], seed, rules: s.rules, ran: Date.now() } })
  }

  const check = async () => {
    const ra = fighter(a)
    const f = toFighter16(ra.fighter)
    ctl.current = new AbortController()
    const bots = ['pressure', 'attack', 'guard', 'random', 'easy']
    const rows = []
    for (let k = 0; k < bots.length; k++) {
      if (ctl.current.signal.aborted) break
      setRunning({ done: k * n, n: bots.length * n, label: `${ALL_LEVELS[bots[k]].label} vs Hard` })
      const r = await runBalance16(f, f, { n, seed, rules: s.rules, W: s.ai, levels: [bots[k], 'hard'], signal: ctl.current.signal,
        onProgress: d => setRunning(x => x && { ...x, done: k * n + d }) })
      rows.push({ bot: bots[k], win: r.win, margin: r.margin, median: r.median })
    }
    setRunning(null)
    upd({ exploit: { name: ra.fighter.name, rows, n, ran: Date.now() } })
  }

  return html`<div class="stack" style=${{ gap: '24px' }}>
    <div class="stack">
      <h1>Lab</h1>
      <p class="lede">Bulk games between two sparring partners on the current decks, edits included. Good for catching dead cards, runaway Supers and big imbalances; not for judging feel, bluffs or how neutral cards play with people.</p>
    </div>
    <div class="panel stack">
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        <label class="field"><span>Fighter A</span><select id="lab-a" value=${a} onChange=${e => upd({ a: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'reference' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>Fighter B</span><select id="lab-b" value=${b} onChange=${e => upd({ b: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'reference' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>A plays as</span><select id="lab-la" value=${la} onChange=${e => upd({ la: e.target.value })}>${Object.entries(ALL_LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>B plays as</span><select id="lab-lb" value=${lb} onChange=${e => upd({ lb: e.target.value })}>${Object.entries(ALL_LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>Seed</span><input id="lab-seed" type="number" value=${seed} onInput=${e => upd({ seed: Math.trunc(Number(e.target.value)) || 0 })} /></label>
      </div>
      <div class="row"><span class="label">Games</span><${Seg} value=${n} options=${SIZES} onChange=${v => upd({ n: v })} label="Games" /></div>
      <p class="small muted">At 300 games a win rate is good to about ±6 points; at 1,000, about ±3. Rules and the partner's weights come from Settings (burn up to ${s.rules.burnMax} a round, Super ${s.rules.superUses ? 'once per game' : 'reusable'}, speed ties ${s.rules.speedTie === 'lowhp' ? 'to less HP' : 'cancel'}). The exploit check plays each mindless bot, and Easy, against Hard in Fighter A's mirror.</p>
      <div class="actions">
        <button class="btn" disabled=${!!running} onClick=${one}>Run this matchup</button>
        <button class="btn ghost" disabled=${!!running} onClick=${check}>Run the exploit check</button>
      </div>
      ${running ? html`<div class="stack" style=${{ gap: '6px' }}>
        <div class="spread small"><span>${running.label}</span><span class="num">${running.done} / ${running.n} games</span></div>
        <div class="progress"><div style=${{ width: `${(100 * running.done) / running.n}%` }}></div></div>
        <div><button class="link" onClick=${() => ctl.current?.abort()}>Stop</button></div>
      </div>` : null}
    </div>
    ${exploit ? html`<section class="panel stack">
      <h3>Exploit check · ${exploit.name} mirror · ${exploit.n} games each</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th class="r">Beats Hard</th><th class="r">Median rounds</th></tr></thead>
        <tbody>${exploit.rows.map(r => html`<tr><td>${ALL_LEVELS[r.bot].label}</td><td class="r">${pct(r.win, 1)} <span class="muted">±${Math.round(100 * r.margin)}</span></td><td class="r">${r.median}</td></tr>`)}</tbody></table></div>
      <p class="small muted">A mindless player shouldn't beat a thoughtful one regularly. Hard never adapts to a pattern, so anything well above 50% here is a hole; well under is sound.</p>
    </section>` : null}
    ${report ? html`<${Report16} r=${report} />` : null}
  </div>`
}

function Report16({ r }) {
  const R = r.totalRounds, n = r.games
  const [a, b] = r.names
  return html`<section class="stack" style=${{ gap: '16px' }}>
    <div class="spread"><h2>${a} vs ${b}</h2><span class="small muted">${n} games · seed ${r.seed} · ${ALL_LEVELS[r.levels[0]].label} vs ${ALL_LEVELS[r.levels[1]].label}</span></div>
    <div class="row">${r.statuses.map((st, k) => html`<span class="small">${r.names[k]} <${StatusChip} status=${st} /></span>`)}</div>
    <div class="winbar" role="img" aria-label=${`${a} ${pct(r.win, 1)}, ${b} ${pct(1 - r.win, 1)}`}>
      <div class="band" style=${{ left: `${100 * (r.win - r.margin)}%`, width: `${200 * r.margin}%`, zIndex: 1 }}></div>
      <div class="a" style=${{ width: `${100 * r.win}%` }}>${a}</div>
      <div class="b" style=${{ width: `${100 * (1 - r.win)}%` }}>${b}</div>
      <div class="mid"></div>
    </div>
    <div class="stats">
      <div class="stat-tile"><span class="label">${a} wins</span><b>${pct(r.win, 1)}</b><span class="small muted">±${Math.round(100 * r.margin)} points</span></div>
      <div class="stat-tile"><span class="label">Median length</span><b>${r.median}</b><span class="small muted">rounds · 10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)}</span></div>
      <div class="stat-tile"><span class="label">Quiet rounds</span><b>${pct(r.quiet / R, 1)}</b><span class="small muted">no HP or pile change</span></div>
      <div class="stat-tile"><span class="label">Combos</span><b>${pct(r.combos / R, 1)}</b><span class="small muted">of rounds · ${(r.comboLen / Math.max(r.combos, 1)).toFixed(1)} cards, ${(r.comboDmg / Math.max(r.combos, 1)).toFixed(1)} HP each · a Starter won ${pct(r.starterWins / R)} of rounds</span></div>
      <div class="stat-tile"><span class="label">Guard beats Pressure</span><b>${pct(r.guardWins / R, 1)}</b><span class="small muted">of rounds · follow-up ${pct(r.follows / Math.max(r.guardWins, 1))}, ${(r.followDmg / Math.max(r.follows, 1)).toFixed(1)} HP each · no Counter in hand ${pct(r.guardWinsNoCounter / Math.max(r.guardWins, 1))}</span></div>
      <div class="stat-tile"><span class="label">Supers</span><b>${((r.supers[0] + r.supers[1]) / n).toFixed(1)}</b><span class="small muted">a game · cards burned ${((r.burned[0] + r.burned[1]) / n).toFixed(1)} a game</span></div>
      <div class="stat-tile"><span class="label">Statuses a game</span><span class="small">${Object.entries(r.statuses).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ') || 'none'}</span></div>
      <div class="stat-tile"><span class="label">How games end</span><span class="small">${share(r.routes, n)}</span></div>
      <div class="stat-tile"><span class="label">Clash outcomes</span><span class="small">${share(r.outcomes, R)}</span></div>
    </div>
    <div class="pickers">
      ${[0, 1].map(k => {
        const T = Object.values(r.types[k]).reduce((s, v) => s + v, 0)
        return html`<div class="panel stack"><h3>${r.names[k]}${r.names[0] === r.names[1] ? ` (${k ? 'B' : 'A'})` : ''}</h3>
          <p class="small"><span class="label">Neutral phase</span><br />${share(r.neutral[k], R)}</p>
          <p class="small"><span class="label">Clash types</span><br />${share(Object.fromEntries(Object.entries(r.types[k]).map(([t, v]) => [{ P: 'Pressure', C: 'Convert', R: 'Guard', '-': 'nothing' }[t] || t, v])), T)}</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Clash card</th><th class="r">Share</th></tr></thead>
            <tbody>${Object.entries(r.plays[k]).sort((x, y) => y[1] - x[1]).map(([c, v]) => html`<tr><td>${c}</td><td class="r">${pct(v / T)}</td></tr>`)}</tbody></table></div>
          <p class="small muted">Hand after a round: ${r.handAvg[k].toFixed(1)} cards · reshuffles ${(r.reshuffles[k] / n).toFixed(2)} a game</p>
        </div>`
      })}
    </div>
    <p class="small muted">Combo Enders: ${share(r.comboEnds, Math.max(r.combos, 1))}.</p>
  </section>`
}
