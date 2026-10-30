// Lab: bulk sparring-partner games, the same runs as the simulator, on the
// current cards (your edits and variants included).

import { html, cx, useState, useRef, pct } from './lib.js'
import { roster, settings } from './store.js'
import { runBalance } from '../engine/game.js'
import { toEngineFighter } from '../engine/fighters.js'
import { Seg, StatusChip } from './ui.js'
import { LEVELS } from '../engine/ai.js'

const SIZES = [[100, '100'], [300, '300'], [500, '500'], [1000, '1,000']]

export function Lab({ state, setState }) {
  const list = roster()
  const ids = list.map(r => r.id)
  const { a = ids[0], b = ids[1] || ids[0], n = 300, seed = 1, report = null, matrix = null, la = 'hard', lb = 'hard' } = state
  const [running, setRunning] = useState(null)
  const ctl = useRef(null)
  const upd = p => setState({ ...state, ...p })
  const s = settings()

  const ra0 = list.find(r => r.id === a), rb0 = list.find(r => r.id === b)
  const mixed = ra0 && rb0 && ra0.rules !== rb0.rules
  const one = async () => {
    const ra = list.find(r => r.id === a), rb = list.find(r => r.id === b)
    if (ra.rules !== rb.rules) return
    ctl.current = new AbortController()
    setRunning({ done: 0, n, label: `${ra.fighter.name} vs ${rb.fighter.name}` })
    const fa = toEngineFighter(ra.fighter), fb = toEngineFighter(rb.fighter)
    const r = await runBalance(fa, fb, { n, seed, rules: s.rules, W: s.ai, levels: [la, lb], signal: ctl.current.signal,
      onProgress: (done) => setRunning(x => x && { ...x, done }) })
    setRunning(null)
    upd({ report: { ...r, ids: [a, b], statuses: [ra.status, rb.status], levels: [la, lb], seed, rules: s.rules, ran: Date.now() } })
  }

  const all = async () => {
    const rs = list.filter(r => (r.status !== 'variant' && !r.reference && !r.draft) || state.withVariants)
    ctl.current = new AbortController()
    const pairs = []
    for (let i = 0; i < rs.length; i++) for (let j = i; j < rs.length; j++) if (rs[i].rules === rs[j].rules) pairs.push([rs[i], rs[j]])
    const cells = {}
    const total = pairs.length * n
    let done = 0
    for (const [x, y] of pairs) {
      if (ctl.current.signal.aborted) break
      setRunning({ done, n: total, label: `${x.fighter.name} vs ${y.fighter.name}` })
      const r = await runBalance(toEngineFighter(x.fighter), toEngineFighter(y.fighter), { n, seed, rules: s.rules, W: s.ai,
        signal: ctl.current.signal, onProgress: d => setRunning(z => z && { ...z, done: done + d }) })
      done += n
      cells[`${x.id}|${y.id}`] = r
    }
    setRunning(null)
    upd({ matrix: { ids: rs.map(r => r.id), names: Object.fromEntries(rs.map(r => [r.id, r.fighter.name])), cells, n, seed, ran: Date.now() } })
  }

  return html`<div class="stack" style=${{ gap: '24px' }}>
    <div class="stack">
      <h1>Lab</h1>
      <p class="lede">Bulk games between two sparring partners: the simulator's players, run here on the current cards, edits included. Good for catching dead cards and big imbalances, not for judging feel or setup cards.</p>
    </div>
    <div class="panel stack">
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        <label class="field"><span>Fighter A</span><select id="lab-a" value=${a} onChange=${e => upd({ a: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'signed-off' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>Fighter B</span><select id="lab-b" value=${b} onChange=${e => upd({ b: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'signed-off' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>Fighter A's partner</span><select id="lab-la" value=${la} onChange=${e => upd({ la: e.target.value })}>${Object.entries(LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>Fighter B's partner</span><select id="lab-lb" value=${lb} onChange=${e => upd({ lb: e.target.value })}>${Object.entries(LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>Seed</span><input id="lab-seed" type="number" value=${seed} onInput=${e => upd({ seed: Math.trunc(Number(e.target.value)) || 0 })} /></label>
      </div>
      <div class="row"><span class="label">Games per matchup</span><${Seg} value=${n} options=${SIZES} onChange=${v => upd({ n: v })} label="Games per matchup" /></div>
      <p class="small muted">At 300 games a win rate is good to about ±6 points; at 1,000, about ±3. Rules and weights come from Settings (${list.every(r => r.rules === 15) ? `Recover payoff: ${s.rules.recoverPayoff}${s.rules.recoverPayoff === 'fixed' ? ` ${s.rules.fixedDamage}` : ''}${s.rules.projectileSafe ? ', Projectiles safe' : ''}` : `Recover chip for v11 fighters: ${s.rules.counterChip}`}). Use Hard for balance checks; pitting a level against Hard measures how much skill matters. The full round-robin always uses Hard, and only pairs fighters on the same rules.</p>
      ${mixed ? html`<p class="small msg-w">${ra0.fighter.name} plays rules v${ra0.rules} and ${rb0.fighter.name} plays rules v${rb0.rules}. Pick two fighters on the same rules.</p>` : null}
      <div class="actions">
        <button class="btn" disabled=${!!running || mixed} onClick=${one}>Run this matchup</button>
        <button class="btn ghost" disabled=${!!running} onClick=${all}>Run every matchup</button>
        <label class="check small"><input type="checkbox" checked=${!!state.withVariants} onChange=${e => upd({ withVariants: e.target.checked })} /> Include variants, drafts and reference fighters</label>
      </div>
      ${running ? html`<div class="stack" style=${{ gap: '6px' }}>
        <div class="spread small"><span>${running.label}</span><span class="num">${running.done} / ${running.n} games</span></div>
        <div class="progress"><div style=${{ width: `${(100 * running.done) / running.n}%` }}></div></div>
        <div><button class="link" onClick=${() => ctl.current?.abort()}>Stop</button></div>
      </div>` : null}
    </div>
    ${report ? html`<${Report} r=${report} list=${list} />` : null}
    ${matrix ? html`<${Matrix} mx=${matrix} />` : null}
  </div>`
}

function Report({ r, list }) {
  const [fa, fb] = r.fighters
  const n = r.games
  return html`<section class="stack" style=${{ gap: '16px' }}>
    <div class="spread"><h2>${fa.name} vs ${fb.name}</h2><span class="small muted">${n} games · seed ${r.seed} · ${fa.v15 ? `rules v15, Recover payoff ${r.rules.recoverPayoff}${r.rules.projectileSafe ? ', Projectiles safe' : ''}` : fa.v12 ? 'rules v12' : `Recover chip ${r.rules.counterChip}`}${r.levels && r.levels.join() !== 'hard,hard' ? ` · ${LEVELS[r.levels[0]].label} vs ${LEVELS[r.levels[1]].label}` : ''}</span></div>
    <div class="row">${r.statuses.map((st, k) => html`<span class="small">${r.fighters[k].name} <${StatusChip} status=${st} /></span>`)}</div>
    <${WinBar} a=${fa.name} b=${fb.name} win=${r.win} margin=${r.margin} />
    <div class="stats">
      <div class="stat-tile"><span class="label">${fa.name} wins</span><b>${pct(r.win, 1)}</b><span class="small muted">±${Math.round(100 * r.margin)} points</span></div>
      ${fa.v15 ? null : html`<div class="stat-tile"><span class="label">Double KOs</span><b>${pct(r.doubleKO / n, 1)}</b><span class="small muted">${pct(r.draws / n, 1)} drawn · target ≤ 25%</span></div>`}
      <div class="stat-tile"><span class="label">Median length</span><b>${r.median}</b><span class="small muted">rounds · 10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)}</span></div>
      <div class="stat-tile"><span class="label">Quiet rounds</span><b>${pct(r.quiet / r.totalRounds, 1)}</b><span class="small muted">no HP or pile change</span></div>
      <div class="stat-tile"><span class="label">Recover mirrors</span><b>${pct(r.recoverMirrors / r.totalRounds, 1)}</b><span class="small muted">of rounds</span></div>
      ${r.v15 ? html`
        <div class="stat-tile"><span class="label">Same-type attacks</span><b>${pct(r.v15.sameType / r.totalRounds, 1)}</b><span class="small muted">of rounds · ${pct(r.v15.ties / Math.max(r.v15.sameType, 1))} tied and cancelled</span></div>
        <div class="stat-tile"><span class="label">Recover beats Pressure</span><b>${pct(r.v15.recoverWins / r.totalRounds, 1)}</b><span class="small muted">of rounds${r.v15.followP + r.v15.followC ? ` · follow-up ${pct(r.v15.followP / r.v15.recoverWins)} Pressure, ${pct(r.v15.followC / r.v15.recoverWins)} Convert, ${(r.v15.followHp / Math.max(r.v15.followP + r.v15.followC, 1)).toFixed(1)} HP each` : r.v15.fixed ? ` · ${(r.v15.fixedHp / r.v15.fixed).toFixed(1)} damage each` : ''}</span></div>
        <div class="stat-tile"><span class="label">Quiet rounds by cause</span><b>${pct((r.v15.quietBy.recovers + r.v15.quietBy.tie) / r.totalRounds, 1)}</b><span class="small muted">two Recovers ${pct(r.v15.quietBy.recovers / r.totalRounds, 1)}, speed ties ${pct(r.v15.quietBy.tie / r.totalRounds, 1)}</span></div>
        <div class="stat-tile"><span class="label">How games end</span><span class="small">${Object.entries(r.routes).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / n)}`).join(', ')}</span></div>` : null}
      ${r.v12 ? html`
        <div class="stat-tile"><span class="label">Same-type attacks</span><b>${pct(r.v12.sameType / r.totalRounds, 1)}</b><span class="small muted">of rounds · ${pct(r.v12.bySpeed / Math.max(r.v12.sameType, 1))} by speed, ${pct(r.v12.trades / Math.max(r.v12.sameType, 1))} trades, ${pct(r.v12.cancels / Math.max(r.v12.sameType, 1))} cancels, ${pct(r.v12.techs / Math.max(r.v12.sameType, 1))} techs</span></div>
        <div class="stat-tile"><span class="label">Guard turn-backs</span><b>${pct(r.v12.guarded / r.totalRounds, 1)}</b><span class="small muted">of rounds · ${(r.v12.guardBuild / Math.max(r.v12.guarded, 1)).toFixed(1)} Build each</span></div>
        ${r.v12.countered ? html`<div class="stat-tile"><span class="label">Counter turn-backs</span><b>${pct(r.v12.countered / r.totalRounds, 1)}</b><span class="small muted">of rounds · ${(r.v12.counterChip / Math.max(r.v12.countered, 1)).toFixed(1)} chip each</span></div>` : null}
        ${r.v12.setups ? html`<div class="stat-tile"><span class="label">Setups interrupted</span><b>${pct(r.v12.interrupted / r.v12.setups, 1)}</b><span class="small muted">of ${r.v12.setups} played</span></div>` : null}` : null}
    </div>
    <div class="pickers">
      ${[0, 1].map(k => html`<${SideTable} f=${r.fighters[k]} S=${r.sides[k]} n=${n} total=${r.totalRounds} />`)}
    </div>
  </section>`
}

function WinBar({ a, b, win, margin }) {
  return html`<div class="winbar" role="img" aria-label=${`${a} ${pct(win, 1)}, ${b} ${pct(1 - win, 1)}`}>
    <div class="band" style=${{ left: `${100 * (win - margin)}%`, width: `${200 * margin}%`, zIndex: 1 }}></div>
    <div class="a" style=${{ width: `${100 * win}%` }}>${a}</div>
    <div class="b" style=${{ width: `${100 * (1 - win)}%` }}>${b}</div>
    <span class="mid" title="50%"></span>
  </div>`
}

function SideTable({ f, S, n, total }) {
  const tot = Object.values(S.plays).reduce((x, y) => x + y, 0) || 1
  const max = Math.max(...Object.values(S.plays), 1)
  const sr = S.superRounds.length ? S.superRounds.reduce((x, y) => x + y, 0) / S.superRounds.length : null
  return html`<div class="panel stack" style=${{ gap: '10px' }}>
    <h3>${f.name}</h3>
    <p class="small muted">Pressure ${pct(S.types.P / tot)} · Convert ${pct(S.types.C / tot)} · Recover ${pct(S.types.R / tot)} · Typeless ${pct(S.types.T / tot)}</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Card</th><th class="r">Share of plays</th><th></th><th class="r">Resolved</th></tr></thead>
      <tbody>${[...f.cards, f.sup].filter(Boolean).map(c => {
        const p = S.plays[c.name] || 0
        return html`<tr data-t=${c.t}>
          <td><span class="tdot" data-t=${c.t}></span> ${c.name}${c.sup ? ' (Super)' : ''}</td>
          <td class="r">${pct(p / tot)}</td>
          <td style=${{ width: '35%' }}><span class="usebar" style=${{ width: `${(100 * p) / max}%` }}></span></td>
          <td class="r">${p ? pct((S.resolved[c.name] || 0) / p) : '–'}</td>
        </tr>`
      })}</tbody>
    </table></div>
    <p class="small muted">${f.sup ? html`Super used in ${pct(1 - S.superUnused / n)} of games${sr ? `, around round ${sr.toFixed(1)}` : ''}.` : 'No Super.'} Without a type in ${pct(S.lockedOut / total, 1)} of rounds.</p>
  </div>`
}

function Matrix({ mx }) {
  const val = (x, y) => {
    const c = mx.cells[`${x}|${y}`]
    if (c) return c.win
    const d = mx.cells[`${y}|${x}`]
    return d ? 1 - d.win : null
  }
  const shade = w => w === null ? 'transparent' : `rgba(${w >= 0.5 ? '102,199,142' : '255,95,107'}, ${Math.min(0.55, Math.abs(w - 0.5) * 4)})`
  return html`<section class="stack">
    <div class="spread"><h2>Every matchup</h2><span class="small muted">${mx.n} games each · seed ${mx.seed}</span></div>
    <p class="small muted">Row fighter's win rate. Mirrors show the first seat's rate, which should sit near 50%.</p>
    <div class="tbl-wrap"><table class="tbl matrix">
      <thead><tr><th></th>${mx.ids.map(id => html`<th class="r">vs ${mx.names[id]}</th>`)}<th class="r">Average</th></tr></thead>
      <tbody>${mx.ids.map(x => {
        const others = mx.ids.filter(y => y !== x).map(y => val(x, y)).filter(v => v !== null)
        const avg = others.length ? others.reduce((p, q) => p + q, 0) / others.length : null
        return html`<tr><th>${mx.names[x]}</th>${mx.ids.map(y => { const w = val(x, y); return html`<td class="cell" style=${{ background: shade(w) }}>${w === null ? '–' : pct(w, 1)}</td>` })}<td class="cell">${avg === null ? '–' : pct(avg, 1)}</td></tr>`
      })}</tbody>
    </table></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Matchup</th><th class="r">Double KOs</th><th class="r">Drawn</th><th class="r">Median rounds</th><th class="r">Quiet rounds</th></tr></thead>
      <tbody>${Object.entries(mx.cells).map(([k, c]) => { const [x, y] = k.split('|'); return html`<tr>
        <td>${mx.names[x]} vs ${mx.names[y]}</td><td class="r">${pct(c.doubleKO / c.games, 1)}</td><td class="r">${pct(c.draws / c.games, 1)}</td><td class="r">${c.median}</td><td class="r">${pct(c.quiet / c.totalRounds, 1)}</td>
      </tr>` })}</tbody>
    </table></div>
  </section>`
}
