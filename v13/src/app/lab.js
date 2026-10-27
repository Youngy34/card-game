// Lab: bulk sparring-partner games, the same runs as the simulator, on the
// current cards (your edits and variants included). Reports the rules v13
// playtest targets.

import { html, useState, useRef, pct } from './lib.js'
import { roster, settings } from './store.js'
import { runBalance } from '../engine/game.js'
import { toEngineFighter } from '../engine/fighters.js'
import { Seg, StatusChip } from './ui.js'
import { LEVELS } from '../engine/ai.js'
import { experimentsOn, dcode } from './play.js'

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
    upd({ report: { ...r, statuses: [ra.status, rb.status], levels: [la, lb], seed, rules: s.rules, ran: Date.now() } })
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
      <p class="small muted">At 100 games a win rate is good to about ±10 points; at 500, about ±4. Games that stall run to the ${s.rules.maxReveals}-reveal safety limit and take longest. Rules and the partner's weights come from Settings: ${exp.length ? html`<span class="exp">experiments on: ${exp.join('; ')}</span>` : 'rules as written'}.</p>
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
  const n = r.games, N = Math.max(r.neutral, 1), B = Math.max(r.beats, 1), C = Math.max(r.combos, 1)
  const res = k => (r.results[k] || 0) / N
  const dmgTotal = Object.values(r.damage).reduce((x, y) => x + y, 0) || 1
  const minus = Math.max(r.minus, 1)
  const lpc = r.linkersPerCombo
  const exp = experimentsOn(r.rules)
  return html`<section class="stack" style=${{ gap: '16px' }}>
    <div class="spread"><h2>${fa.name} vs ${fb.name}</h2><span class="small muted">${n} games · seed ${r.seed}${r.levels.join() !== 'hard,hard' ? ` · ${LEVELS[r.levels[0]].label} vs ${LEVELS[r.levels[1]].label}` : ''} · ${exp.length ? `experiments: ${exp.join('; ')}` : 'rules as written'}</span></div>
    <div class="row">${r.statuses.map((st, k) => html`<span class="small">${r.fighters[k].name} <${StatusChip} status=${st} /></span>`)}</div>
    <${WinBar} a=${fa.name} b=${fb.name} win=${r.winRate} margin=${r.margin} />
    <div class="stats">
      <${Tile} label=${`${fa.name} wins`} value=${pct(r.winRate, 1)} sub=${`±${Math.round(100 * r.margin)} points`} />
      <${Tile} label="Draws" value=${pct(r.draws / n, 1)} sub=${r.routes['draw (reveal limit)'] ? `${pct(r.routes['draw (reveal limit)'] / n)} hit the ${r.rules.maxReveals}-reveal limit` : 'none at the reveal limit'} state=${r.draws / n > 0.1 ? 'off' : 'ok'} />
      <${Tile} label="Game length" value=${r.median} sub=${`median reveals · 10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)} · target 20–30`} state=${r.median >= 15 && r.median <= 40 ? 'ok' : 'off'} />
      <${Tile} label="Two defences" value=${pct(r.twoDef / N)} sub="of neutral reveals: both players wait" state=${r.twoDef / N > 0.4 ? 'off' : null} />
      <${Tile} label="Minus player guards" value=${pct(r.minusGuard / minus)} sub=${`target under ~50% · defends ${pct(r.minusDefend / minus)} in all`} state=${r.minusGuard / minus < 0.5 ? 'ok' : 'off'} />
      <${Tile} label="Holder attacks" value=${pct(r.holderAttack / minus)} sub=${`of neutral reveals · streak ${fx(r.avgStreak)} reveals`} />
      <${Tile} label="Linkers per combo" value=${fx(lpc, 2)} sub="landed · target about 2" state=${lpc === null ? null : lpc >= 1.5 && lpc <= 3 ? 'ok' : 'off'} />
      <${Tile} label="Reveals per hit" value=${fx(r.revealsPerHit)} sub=${`neutral reveals per combo · ${fx(r.combos / n)} combos a game`} />
      <${Tile} label="Starting initiative" value=${pct(r.startRate, 1)} sub="win rate of whoever started with it" />
      <${Tile} label="Read focus" value=${pct(r.readFocus)} sub="share of the best mix on its likeliest kind of move · an even spread is 17%" />
      <${Tile} label="Read shift" value=${pct(r.readShift)} sub="how far the best mix moves each neutral reveal · 0% is the same guess every time" />
    </div>
    <div class="pickers">
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>Neutral</h3>
        <${Bars} rows=${[['Hit', res('hit')], ['Blocked', res('blocked')], ['Thrown', res('thrown')], ['Evaded', res('evaded')], ['Exposed', res('exposed')], ['Both defend', res('none')]]} />
        <p class="small muted">Clashes ${pct(r.clashes / N)} of neutral reveals. After Exposed: ${r.counters.hit} counter hits, ${r.counters.thrown} counter throws, ${r.counters.declined} declined, ${r.counters.none} with nothing fast enough.${r.guardGrey || r.throwCashes ? ` Guard damage ${fx(r.guardGrey / n)} grey a game; ${r.throwCashes} throws cashed a pile (${fx(r.throwCash / Math.max(r.throwCashes, 1))} each).` : ''}</p>
      </div>
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>Combos</h3>
        <${Bars} rows=${[['Ended by an ender', r.comboEnds.ender / C], ['Broken', r.comboEnds.broken / C], ['Dropped', r.comboEnds.dropped / C], ['Blew out', r.comboEnds.blowout / C], ['Opener KOed', r.comboEnds.ko / C]]} />
        <p class="small muted">${fx(r.comboDamage / C)} damage per combo, opener included. Defender held ${pct(r.holds / B)} of beats; Breaks Light ${r.breakPlays.BL}, Medium ${r.breakPlays.BM}, Heavy ${r.breakPlays.BH} (${r.broken} broke a linker, ${r.wrongBreak} wrong strength, ${r.breakVsEnder} wasted on an ender). Feints ${r.feints}: ${r.locked} locked a Break, ${r.dropped} dropped. Leftover grey after ${r.leftover} combos (${fx(r.leftoverGrey / Math.max(r.leftover, 1))} each); median peak pile ${r.medianPeakPile ?? '–'}.</p>
      </div>
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>Damage by source</h3>
        <${Bars} rows=${[['Openers', r.damage.opener / dmgTotal], ['Counters', r.damage.counter / dmgTotal], ['Throws', r.damage.throw / dmgTotal], ['Enders', r.damage.ender / dmgTotal]]} />
      </div>
      <div class="panel stack" style=${{ gap: '10px' }}>
        <h3>How games end</h3>
        <div class="tbl-wrap"><table class="tbl"><tbody>${Object.entries(r.routes).sort((x, y) => y[1] - x[1]).map(([k, c]) => html`<tr><td>${k}</td><td class="r">${c}</td><td class="r">${pct(c / n)}</td></tr>`)}</tbody></table></div>
      </div>
    </div>
    <div class="pickers">
      ${[0, 1].map(k => html`<${SideTable} f=${r.fighters[k]} S=${r.sides[k]} />`)}
    </div>
  </section>`
}

function Bars({ rows }) {
  return html`<div class="bars">${rows.map(([label, v]) => html`<div class="bar-row">
    <span>${label}</span><span class="bar"><span style=${{ width: `${Math.min(100, 100 * (v || 0))}%` }}></span></span><span class="num r">${pct(v || 0)}</span>
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
  const tot = Object.values(S.neutral).reduce((x, y) => x + y, 0) || 1
  const rows = [...f.cards.map(c => [c.name, c.dir]), ['Guard', 'G'], ['Duck', 'D'], ['Step', 'S']]
  const max = Math.max(...rows.map(([nm]) => S.neutral[nm] || 0), 1)
  return html`<div class="panel stack" style=${{ gap: '10px' }}>
    <h3>${f.name}</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Card</th><th class="r">Neutral</th><th></th><th class="r">Counter</th><th class="r">Linker</th><th class="r">Ender</th></tr></thead>
      <tbody>${rows.map(([nm, d]) => {
        const p = S.neutral[nm] || 0
        return html`<tr>
          <td><span class="tdot" data-d=${dcode(d)}></span> ${nm}</td>
          <td class="r">${pct(p / tot)}</td>
          <td style=${{ width: '28%' }}><span class="usebar" data-d=${dcode(d)} style=${{ width: `${(100 * p) / max}%` }}></span></td>
          <td class="r">${S.counter[nm] || '–'}</td><td class="r">${S.linker[nm] || '–'}</td><td class="r">${S.ender[nm] || '–'}</td>
        </tr>`
      })}</tbody>
    </table></div>
    <p class="small muted">Neutral: share of that fighter's neutral picks. Counter, Linker and Ender: times played that way.</p>
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
      <thead><tr><th>Matchup</th><th class="r">Draws</th><th class="r">Median reveals</th><th class="r">Two defences</th><th class="r">Linkers per combo</th></tr></thead>
      <tbody>${Object.entries(mx.cells).map(([k, c]) => { const [x, y] = k.split('|'); return html`<tr>
        <td>${mx.names[x]} vs ${mx.names[y]}</td><td class="r">${pct(c.draws / c.games, 1)}</td><td class="r">${c.median}</td><td class="r">${pct(c.twoDef / Math.max(c.neutral, 1))}</td><td class="r">${fx(c.linkersPerCombo, 2)}</td>
      </tr>` })}</tbody>
    </table></div>
  </section>`
}
