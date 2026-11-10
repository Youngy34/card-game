// A balance report as plain text lines, for the command-line simulator. The
// app's Lab shows the same figures as tiles and tables.

import { CODES, TYPE_LABEL } from './rules.js'
import { squeezeRows } from './game.js'

const pct = (x, d = 0) => (x === null || x === undefined || !isFinite(x) ? '–' : `${(100 * x).toFixed(d)}%`)
const num = (x, d = 1) => (x === null || x === undefined || !isFinite(x) ? '–' : x.toFixed(d))

export function reportLines(r) {
  const [fa, fb] = r.fighters
  const n = Math.max(r.games, 1), N = Math.max(r.reveals, 1)
  const res = k => r.results[k] || 0
  const dmgTotal = CODES.reduce((s, t) => s + r.damage[t], 0) || 1
  const lines = []
  lines.push(`${fa.name} wins ${pct(r.winRate, 1)} ± ${Math.round(100 * r.margin)} · draws ${pct(r.draws / n, 1)}${r.doubleKOs ? ` · double KOs ${pct(r.doubleKOs / n, 1)}` : ''}`)
  lines.push(`Length: median ${r.median} reveals (10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)}) · mirrors ${pct(r.mirrorRate)} of reveals${r.trades ? ` (${r.trades} took effect)` : ''}`)
  lines.push(`Reveals won by: ${CODES.map(t => `${TYPE_LABEL[t]} ${pct(r.wonBy[t] / N)}`).join(' · ')}`)
  lines.push(`Results: Strike hits ${res('hit')}, cashes ${res('cash')} (${num(r.meanCash)} grey each; ${r.emptyCashes} on an empty pile), Focus clears ${r.clears} (${num(r.cleared / Math.max(r.clears, 1))} each), Strikes blocked ${r.turnbacks} (${num(r.turnbackGrey / Math.max(r.turnbacks, 1))} grey back), Heavies blocked ${r.stopped}${r.doubles ? `, doubles ${r.doubles} (+${num(r.doubleGrey / r.doubles)} each)` : ''}${r.fizzles ? `, fizzles ${r.fizzles}` : ''}`)
  lines.push(`Piles: median peak ${r.medianPeak} · highest ${r.maxPeak}`)
  if (r.metered) lines.push(`Meter: ${num(r.meterGained / n)} gained per game (both players) · ${pct(r.maxedGames / n)} of players fill it (median reveal ${r.medianMaxedAt ?? '–'}) · ${num(r.endMeter / n / 2)} each at the end`)
  lines.push(`Damage by type: ${CODES.filter(t => r.damage[t]).map(t => `${TYPE_LABEL[t]} ${pct(r.damage[t] / dmgTotal)}`).join(' · ')} · cashed grey ${pct(r.cashed / dmgTotal)}, chip ${pct(r.chip / dmgTotal)}`)
  lines.push(`Game ends: ${Object.entries(r.routes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / n)}`).join(', ')}`)
  for (const k of [0, 1]) {
    const f = r.fighters[k], S = r.sides[k]
    const tot = CODES.reduce((s, t) => s + S.plays[t], 0) || 1
    lines.push(`${f.name} plays: ${CODES.map(t => `${TYPE_LABEL[t]} ${pct(S.plays[t] / tot)} (won ${pct(S.won[t] / Math.max(S.plays[t], 1))})`).join(' · ')}`)
  }
  lines.push('The squeeze (both players, by what the opponent was missing):')
  for (const row of squeezeRows(r)) {
    lines.push(`  their ${TYPE_LABEL[row.missing]} out: ${CODES.map(t => `${TYPE_LABEL[t]} ${pct(row.share[t])}`).join(' · ')}`)
  }
  return lines
}
