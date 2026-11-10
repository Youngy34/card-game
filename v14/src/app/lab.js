// Lab: bulk sparring-partner games, the same runs as the simulator, on the
// current cards (your edits and variants included). Reports the rules v14
// playtest targets.

import { html, useState, useRef, pct } from './lib.js'
import { roster, settings } from './store.js'
import { runBalance, squeezeRows } from '../engine/game.js'
import { toEngineFighter } from '../engine/fighters.js'
import { Seg, StatusChip } from './ui.js'
import { LEVELS, depthOf } from '../engine/ai.js'
import { CODES, TYPE_LABEL } from '../engine/rules.js'
import { experimentsOn } from './play.js'

const SIZES = [[50, '50'], [100, '100'], [200, '200'], [500, '500']]
const fx = (x, d = 1) => (x === null || x === undefined || !isFinite(x) ? '–' : x.toFixed(d))

export function Lab({ state, setState }) {
  const list = roster()
  const ids = list.map(r => r.id)
  const { a = ids[0], b = ids[1] || ids[0], n = 100, seed = 1, report = null, matrix = null, la = 'hard', lb = 'hard' } = state
  const [running, setRunning] = useState(null)
  const ctl = useRef(null)
  const upd = p => setState({ ...state, ...p })
  const s = settings()
  const exp = experimentsOn(s.rules)

  const one = async () => {
    const ra = list.find(r => r.id === a), rb = list.find(r => r.id === b)
    ctl.current = new AbortController()
    setRunning({ done: 0, n, label: `${ra.fighter.name} vs ${rb.fighter.name}` })
    const r = await runBalance(toEngineFighter(ra.fighter), toEngineFighter(rb.fighter), { n, seed, rules: s.rules, W: s.ai, levels: [la, lb],
      signal: ctl.current.signal, onProgress: done => setRunning(x => x && { ...x, done }) })
    setRunning(null)
    upd({ report: { ...r, statuses: [ra.status, rb.status], levels: [la, lb], seed, rules: s.rules, depth: depthOf(s.ai), ran: Date.now() } })
  }

  const all = async () => {
    const rs = list.filter(r => r.status !== 'variant' || state.withVariants)
    ctl.current = new AbortController()
    const pairs = []
    for (let i = 0; i < rs.length; i++) for (let j = i; j < rs.length; j++) pairs.push([rs[i], rs[j]])
    const cells = {}
    const total = pairs.length * n
    let done = 0
    for (const [x, y] of pairs) {
      if (ctl.current.signal.aborted) break
      setRunning({ done, n: total, label: `${x.fighter.name} vs ${y.fighter.name}` })
      cells[`${x.id}|${y.id}`] = await runBalance(toEngineFighter(x.fighter), toEngineFighter(y.fighter), { n, seed, rules: s.rules, W: s.ai,
        signal: ctl.current.signal, onProgress: d => setRunning(z => z && { ...z, done: done + d }) })
      done += n
    }
    setRunning(null)
    upd({ matrix: { ids: rs.map(r => r.id), names: Object.fromEntries(rs.map(r => [r.id, r.fighter.name])), cells, n, seed, ran: Date.now() } })
  }

  return html`<div class="stack" style=${{ gap: '24px' }}>
    <div class="stack">
      <h1>Lab</h1>
      <p class="lede">Bulk games between two sparring partners, run here on the current cards, edits included. Good for spotting dead cards, lopsided matchups and whether the playtest targets are met; not for judging feel.</p>
    </div>
    <div class="panel stack">
      <div class="grid3" style=${{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        <label class="field"><span>Fighter A</span><select id="lab-a" value=${a} onChange=${e => upd({ a: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'draft' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>Fighter B</span><select id="lab-b" value=${b} onChange=${e => upd({ b: e.target.value })}>${list.map(r => html`<option value=${r.id}>${r.fighter.name}${r.status !== 'draft' ? ` (${r.status})` : ''}</option>`)}</select></label>
        <label class="field"><span>Fighter A's partner</span><select id="lab-la" value=${la} onChange=${e => upd({ la: e.target.value })}>${Object.entries(LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>Fighter B's partner</span><select id="lab-lb" value=${lb} onChange=${e => upd({ lb: e.target.value })}>${Object.entries(LEVELS).map(([k, l]) => html`<option value=${k}>${l.label}</option>`)}</select></label>
        <label class="field"><span>Seed</span><input id="lab-seed" type="number" value=${seed} onInput=${e => upd({ seed: Math.trunc(Number(e.target.value)) || 0 })} /></label>
      </div>
      <div class="row"><span class="label">Games per matchup</span><${Seg} value=${n} options=${SIZES} onChange=${v => upd({ n: v })} label="Games per matchup" /></div>
      <p class="small muted">At 100 games a win rate is good to about ±10 points; at 500, about ±4. A game takes about 0.05 seconds with the partner looking ${depthOf(s.ai)} reveal${depthOf(s.ai) > 1 ? 's' : ''} ahead${depthOf(s.ai) > 2 ? ' (3 is slow: expect several seconds a game)' : ''}. Rules and the partner's weights come from Settings: ${exp.length ? html`<span class="exp">experiments on: ${exp.join('; ')}</span>` : 'rules as written'}.</p>
      <div class="actions">
        <button class="btn" disabled=${!!running} onClick=${one}>Run this matchup</button>
        <button class="btn ghost" disabled=${!!running} onClick=${all}>Run every matchup</button>
        <label class="check small"><input id="lab-variants" type="checkbox" checked=${!!state.withVariants} onChange=${e => upd({ withVariants: e.target.checked })} /> Include variants</label>
      </div>
      ${running ? html`<div class="stack" style=${{ gap: '6px' }}>
        <div class="spread small"><span>${running.label}</span><span class="num">${running.done} / ${running.n} games</span></div>
        <div class="progress"><div style=${{ width: `${(100 * running.done) / running.n}%` }}></div></div>
        <div><button class="link" onClick=${() => ctl.current?.abort()}>Stop</button></div>
      </div>` : null}
    </div>
    ${report ? html`<${Report} r=${report} />` : null}
    ${matrix ? html`<${Matrix} mx=${matrix} />` : null}
  </div>`
}

// a stat tile with a target: state 'ok' | 'off' | null
function Tile({ label, value, sub, state }) {
  return html`<div class="stat-tile" data-state=${state || undefined}><span class="label">${label}</span><b>${value}</b>${sub ? html`<span class="small muted">${sub}</span>` : null}</div>`
}

function Report({ r }) {
  const [fa, fb] = r.fighters
  const n = r.games, N = Math.max(r.reveals, 1)
  const dmgTotal = CODES.reduce((x, t) => x + r.damage[t], 0) || 1
  const exp = experimentsOn(r.rules)
  const mr = r.mirrorRate
  return html`<section class="stack" style=${{ gap: '16px' }}>
    <div class="spread"><h2>${fa.name} vs ${fb.name}</h2><span class="small muted">${n} games · seed ${r.seed} · depth ${r.depth}${r.levels.join() !== 'hard,hard' ? ` · ${LEVELS[r.levels[0]].label} vs ${LEVELS[r.levels[1]].label}` : ''} · ${exp.length ? `experiments: ${exp.join('; ')}` : 'rules as written'}</span></div>
    <div class="row">${r.statuses.map((st, k) => html`<span class="small">${r.fighters[k].name} <${StatusChip} status=${st} /></span>`)}</div>
    <${WinBar} a=${fa.name} b=${fb.name} win=${r.winRate} margin=${r.margin} />
    <div class="stats">
      <${Tile} label=${`${fa.name} wins`} value=${pct(r.winRate, 1)} sub=${`±${Math.round(100 * r.margin)} points · target 45–55%`} state=${r.winRate >= 0.45 && r.winRate <= 0.55 ? 'ok' : 'off'} />
      <${Tile} label="Draws" value=${pct(r.draws / n, 1)} sub=${r.routes['draw (reveal limit)'] ? `${pct(r.routes['draw (reveal limit)'] / n)} hit the ${r.rules.maxReveals}-reveal limit` : 'none at the reveal limit'} state=${r.draws / n > 0.05 ? 'off' : 'ok'} />
      <${Tile} label="Game length" value=${r.median} sub=${`median reveals · 10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)} · target 30–45`} state=${r.median >= 30 && r.median <= 45 ? 'ok' : 'off'} />
      <${Tile} label="Mirrors" value=${pct(mr)} sub="of reveals where both played the same type and nothing happened" />
      <${Tile} label="Peak pile" value=${r.medianPeak ?? '–'} sub=${`median per game · highest ${r.maxPeak ?? '–'}`} />
      <${Tile} label="Cash size" value=${fx(r.meanCash)} sub=${`grey per cash · ${pct(r.emptyCashes / Math.max(r.cashes, 1))} cashed an empty pile`} />
      ${r.doubleKOs ? html`<${Tile} label="Double KOs" value=${pct(r.doubleKOs / n, 1)} sub="of games" />` : null}
      ${r.metered ? html`<${Tile} label="Meter gained" value=${fx(r.meterGained / n)} sub=${`per game, both players · ${pct(r.maxedGames / n)} of players fill it${r.medianMaxedAt ? ` (median reveal ${r.medianMaxedAt})` : ''}`} />` : null}
    </div>
    <div class="pickers">
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>Which type wins reveals</h3>
        <${Bars} rows=${[...CODES.map(t => [TYPE_LABEL[t], r.wonBy[t] / N, t]), ['Mirror', mr, null]]} />
        <p class="small muted">Strikes landed ${r.results.hit || 0}. Cashes ${r.cashes} (${fx(r.meanCash)} grey each). Focus cleared ${r.clears} times (${fx(r.cleared / Math.max(r.clears, 1))} grey each). Strikes blocked ${r.turnbacks} (${fx(r.turnbackGrey / Math.max(r.turnbacks, 1))} grey back each); Heavies blocked ${r.stopped}.${r.doubles ? ` Doubles ${r.doubles} (+${fx(r.doubleGrey / r.doubles)} each).` : ''}${r.fizzles ? ` Fizzles ${r.fizzles}.` : ''}</p>
      </div>
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>Damage by type</h3>
        <${Bars} rows=${['S', 'H', 'G'].map(t => [TYPE_LABEL[t], r.damage[t] / dmgTotal, t])} />
        <p class="small muted">${pct(r.cashed / dmgTotal)} of all damage came from cashed grey and ${pct(r.chip / dmgTotal)} from chip.</p>
      </div>
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>How games end</h3>
        <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(r.routes).sort((x, y) => y[1] - x[1]).map(([k, c]) => html`<tr><td>${k}</td><td class="r">${c}</td><td class="r">${pct(c / n)}</td></tr>`)}</tbody></table></div>
        <p class="small muted">The type of the card that dealt the K.O.</p>
      </div>
    </div>
    <div class="pickers">
      ${[0, 1].map(k => html`<${SideTable} f=${r.fighters[k]} S=${r.sides[k]} />`)}
    </div>
    <${Squeeze} r=${r} />
  </section>`
}

// What each type is worth when the opponent is missing one: the base game's main read
function Squeeze({ r }) {
  const rows = squeezeRows(r)
  if (!rows.length) return null
  return html`<div class="panel stack" style=${{ gap: '10px' }}>
    <h3>The squeeze</h3>
    <p class="small muted">What players chose when the opponent couldn't play a type (both fighters together). A type under about 5% in a row has lost its point in that situation.</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Their card cooling down</th>${CODES.map(t => html`<th class="r"><span class="tdot" data-d=${t}></span> ${TYPE_LABEL[t]}</th>`)}<th class="r">Picks</th></tr></thead>
      <tbody>${rows.map(row => html`<tr><td><span class="tdot" data-d=${row.missing}></span> ${TYPE_LABEL[row.missing]}</td>
        ${CODES.map(t => html`<td class=${row.share[t] < 0.05 ? 'r low' : 'r'}>${pct(row.share[t])}</td>`)}<td class="r muted">${row.n}</td></tr>`)}</tbody>
    </table></div>
  </div>`
}

function Bars({ rows }) {
  return html`<div class="bars">${rows.map(([label, v, d]) => html`<div class="bar-row">
    <span>${label}</span><span class="bar" data-d=${d || undefined}><span style=${{ width: `${Math.min(100, 100 * (v || 0))}%` }}></span></span><span class="num r">${pct(v || 0)}</span>
  </div>`)}</div>`
}

function WinBar({ a, b, win, margin }) {
  return html`<div class="winbar" role="img" aria-label=${`${a} ${pct(win, 1)}, ${b} ${pct(1 - win, 1)}`}>
    <div class="band" style=${{ left: `${100 * (win - margin)}%`, width: `${200 * margin}%`, zIndex: 1 }}></div>
    <div class="a" style=${{ width: `${100 * win}%` }}>${a}</div>
    <div class="b" style=${{ width: `${100 * (1 - win)}%` }}>${b}</div>
    <span class="mid" title="50%"></span>
  </div>`
}

function SideTable({ f, S }) {
  const tot = CODES.reduce((x, t) => x + S.plays[t], 0) || 1
  const rows = f.cards.map(c => [c.name, c.t, S.cards[c.name] || { plays: 0, won: 0, lost: 0, mirror: 0 }])
  const max = Math.max(...rows.map(([, , v]) => v.plays), 1)
  const p = (a, b) => (b ? pct(a / b) : '–')
  return html`<div class="panel stack" style=${{ gap: '10px' }}>
    <h3>${f.name}</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Card</th><th class="r">Played</th><th></th><th class="r">Won</th><th class="r">Lost</th><th class="r">Mirror</th></tr></thead>
      <tbody>${rows.map(([nm, t, v]) => html`<tr>
        <td><span class="tdot" data-d=${t}></span> ${nm}</td>
        <td class="r">${pct(v.plays / tot)}</td>
        <td style=${{ width: '24%' }}><span class="usebar" data-d=${t} style=${{ width: `${(100 * v.plays) / max}%` }}></span></td>
        <td class="r">${p(v.won, v.plays)}</td><td class="r">${p(v.lost, v.plays)}</td><td class="r">${p(v.mirror, v.plays)}</td>
      </tr>`)}</tbody>
    </table></div>
    <p class="small muted">Played: share of this fighter's picks. Won, lost and mirror: what happened when it was played.</p>
  </div>`
}

function Matrix({ mx }) {
  const val = (x, y) => {
    const c = mx.cells[`${x}|${y}`]
    if (c) return c.winRate
    const d = mx.cells[`${y}|${x}`]
    return d ? 1 - d.winRate : null
  }
  const shade = w => (w === null ? 'transparent' : `color-mix(in srgb, ${w >= 0.5 ? 'var(--good)' : 'var(--bad)'} ${Math.round(Math.min(55, Math.abs(w - 0.5) * 400))}%, transparent)`)
  return html`<section class="stack">
    <div class="spread"><h2>Every matchup</h2><span class="small muted">${mx.n} games each · seed ${mx.seed}</span></div>
    <p class="small muted">Row fighter's win rate. Mirrors show the first seat's rate, which should sit near 50%.</p>
    <div class="tbl-wrap"><table class="tbl matrix">
      <thead><tr><th></th>${mx.ids.map(id => html`<th class="r">vs ${mx.names[id]}</th>`)}</tr></thead>
      <tbody>${mx.ids.map(x => html`<tr><th>${mx.names[x]}</th>${mx.ids.map(y => { const w = val(x, y); return html`<td class="cell" style=${{ background: shade(w) }}>${w === null ? '–' : pct(w, 1)}</td>` })}</tr>`)}</tbody>
    </table></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Matchup</th><th class="r">Draws</th><th class="r">Median reveals</th><th class="r">Mirrors</th><th class="r">Median peak pile</th></tr></thead>
      <tbody>${Object.entries(mx.cells).map(([k, c]) => { const [x, y] = k.split('|'); return html`<tr>
        <td>${mx.names[x]} vs ${mx.names[y]}</td><td class="r">${pct(c.draws / c.games, 1)}</td><td class="r">${c.median}</td><td class="r">${pct(c.mirrorRate)}</td><td class="r">${c.medianPeak ?? '–'}</td>
      </tr>` })}</tbody>
    </table></div>
  </section>`
}
