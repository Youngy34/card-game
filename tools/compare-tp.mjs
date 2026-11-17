// Compare today's time-out (v23ab) with the time-out penalty (v23tp), from docs/sim/timeout-17nov/*.json
//   node tools/compare-tp.mjs
import fs from 'fs'
const D = 'docs/sim/timeout-17nov/'
const load = f => (fs.existsSync(D + f) ? JSON.parse(fs.readFileSync(D + f, 'utf8')) : null)
const pct = v => (100 * v).toFixed(1) + '%'
const hard = f => load(f)?.find(x => x.kind === 'hard')
// pool runs: games-weighted
function pool(rs) {
  rs = rs.filter(Boolean); const n = rs.reduce((a, r) => a + r.n, 0)
  const w = k => rs.reduce((a, r) => a + r[k] * r.n, 0) / n
  const P = rs.reduce((a, r) => { for (const k in r.penalty) a[k] = (a[k] || 0) + r.penalty[k]; return a }, {})
  const lg = k => { const a = rs.reduce((t, r) => t + r.lateGuard[k].share * r.lateGuard[k].n, 0), b = rs.reduce((t, r) => t + r.lateGuard[k].n, 0); return { share: a / Math.max(1, b), n: b } }
  const gs = rs.reduce((t, r) => t + (r.guardShare[0] + r.guardShare[1]) / 2 * r.n, 0) / n
  return { n, timeouts: w('timeouts'), decisive: w('decisive'), medians: rs.map(r => r.median), P, late: { early: lg('early'), all: lg('all'), short: lg('short'), long: lg('long') }, guard: gs, gd: rs.reduce((t, r) => t + r.v23[0].guardDrawsPerGame * r.n, 0) / n }
}
// Brawler's win share across both seat orders
const bw = rs => { let w = 0, n = 0; for (const [r, side] of rs) if (r) { w += (side === 0 ? r.win : 1 - r.win) * r.n; n += r.n } return w / Math.max(1, n) }
for (const ed of ['ab', 'c0', 'tp', 'ab2', 'tp2']) {
  const bz = [hard(`${ed}_bz.json`), hard(`${ed}_zb.json`), hard(`${ed}_bz9.json`), hard(`${ed}_zb9.json`)]
  const B = pool(bz), MB = pool([hard(`${ed}_mir_b.json`)]), MZ = pool([hard(`${ed}_mir_z.json`)])
  console.log(`\n== v23${ed} ==`)
  console.log(`Brawler v Zoner: Brawler ${pct(bw([[bz[0], 0], [bz[1], 1], [bz[2], 0], [bz[3], 1]]))} (${B.n} games) · medians ${B.medians.join('/')} · time-outs ${pct(B.timeouts)} · swing ${pct(B.decisive)}`)
  for (const [name, X] of [['B v Z', B], ['Brawler mirror', MB], ['Zoner mirror', MZ]]) {
    const p = X.P
    console.log(`${name.padEnd(15)} n ${X.n} · time-outs ${pct(X.timeouts)} (${p.timeouts}) · swing ${pct(X.decisive)} · median ${X.medians.join('/')} · Guard share ${pct(X.guard)} · Guard draws ${X.gd.toFixed(2)}/game`)
    console.log(`   at time-outs: one deck alone out ${p.paperOut}/${p.timeouts} · penalised ${p.penalised} · changed ${p.changed} · 3 HP on paper would change ${p.paper3} · draws ${p.draws} (before penalty ${p.preDraws})`)
    console.log(`   Guard share: early ${pct(X.late.early.share)} (${X.late.early.n}) · late ${pct(X.late.all.share)} (${X.late.all.n}) · late, smaller deck ${pct(X.late.short.share)} (${X.late.short.n}) · late, larger deck ${pct(X.late.long.share)} (${X.late.long.n})`)
  }
}
// the ladder and the blind partner (v23tp only)
const med = [load('tp_med_bz.json'), load('tp_med_zb.json')].filter(Boolean).flat()
if (med.length) { const m = med.map(r => (r.kind.endsWith('0') ? r.win : 1 - r.win)); console.log(`\nMedium against Hard (v23tp): ${med.map(r => `${r.matchup.join(' v ')} ${r.kind} ${pct(r.kind.endsWith('0') ? r.win : 1 - r.win)}`).join(' · ')} · mean ${pct(m.reduce((a, v) => a + v, 0) / m.length)}`) }
const kb = [load('tp_kb_bz.json'), load('tp_kb_zb.json')].filter(Boolean).flat()
if (kb.length) {
  const m = kb.map(r => (r.kind === 'kb0' ? r.win : 1 - r.win))
  console.log(`Blind to the penalty against Hard (v23tp): ${kb.map(r => `${r.matchup.join(' v ')} ${r.kind} blind wins ${pct(r.kind === 'kb0' ? r.win : 1 - r.win)} (time-outs ${pct(r.timeouts)}, penalised ${r.penalty.penalised})`).join(' · ')} · mean ${pct(m.reduce((a, v) => a + v, 0) / m.length)}`)
}
