// A balance report as plain text lines, for the command-line simulator. The
// app's Lab shows the same figures as tiles and tables.

const pct = (x, d = 0) => (x === null || x === undefined || !isFinite(x) ? '–' : `${(100 * x).toFixed(d)}%`)
const num = (x, d = 1) => (x === null || x === undefined || !isFinite(x) ? '–' : x.toFixed(d))

export function reportLines(r) {
  const [fa, fb] = r.fighters
  const N = Math.max(r.neutral, 1), B = Math.max(r.beats, 1), C = Math.max(r.combos, 1)
  const res = k => r.results[k] || 0
  const dmgTotal = Object.values(r.damage).reduce((a, b) => a + b, 0) || 1
  const lines = []
  lines.push(`${fa.name} wins ${pct(r.winRate, 1)} ± ${Math.round(100 * r.margin)} · draws ${pct(r.draws / r.games, 1)} · starting initiative wins ${pct(r.startRate, 1)}`)
  lines.push(`Length: median ${r.median} reveals (10–90%: ${Math.round(r.p10)}–${Math.round(r.p90)}) · ${num(r.neutral / r.games)} neutral, ${num(r.beats / r.games)} combo beats per game`)
  lines.push(`Neutral results: hit ${pct(res('hit') / N)} · blocked ${pct(res('blocked') / N)} · thrown ${pct(res('thrown') / N)} · evaded ${pct(res('evaded') / N)} · exposed ${pct(res('exposed') / N)} · two defences ${pct(res('none') / N)}  (clashes ${pct(r.clashes / N)})`)
  lines.push(`Counters after Exposed: hit ${r.counters.hit}, throw ${r.counters.thrown}, declined ${r.counters.declined}, none possible ${r.counters.none}`)
  lines.push(`Read strength: focus ${pct(r.readFocus)} (an even spread over six kinds is 17%) · shift ${pct(r.readShift)} per reveal (0% = the same guess every time)`)
  if (r.guardGrey || r.throwCashes) lines.push(`Grey in neutral: ${num(r.guardGrey / r.games)} guard damage per game · ${r.throwCashes} throws cashed a pile (${num(r.throwCash / Math.max(r.throwCashes, 1))} each)`)
  lines.push(`Initiative: minus player guards ${pct(r.minusGuard / Math.max(r.minus, 1))} (target under ~50%), defends ${pct(r.minusDefend / Math.max(r.minus, 1))}; holder attacks ${pct(r.holderAttack / Math.max(r.minus, 1))} · average streak ${num(r.avgStreak)} neutral reveals`)
  lines.push(`Reveals per landed hit: ${num(r.revealsPerHit)} · combos ${num(r.combos / r.games)} per game`)
  lines.push(`Combos: ${num(r.linkersPerCombo, 2)} linkers landed each (target ~2) · ${num(r.comboDamage / C)} damage each incl. opener · end by ender ${pct(r.comboEnds.ender / C)}, broken ${pct(r.comboEnds.broken / C)}, dropped ${pct(r.comboEnds.dropped / C)}, blowout ${pct(r.comboEnds.blowout / C)}, KO ${pct(r.comboEnds.ko / C)}`)
  lines.push(`Combo beats: defender holds ${pct(r.holds / B)}, breaks L/M/H ${r.breakPlays.BL}/${r.breakPlays.BM}/${r.breakPlays.BH} · broken ${r.broken}, wrong strength ${r.wrongBreak}, wasted on enders ${r.breakVsEnder} · feints ${r.feints} (locked ${r.locked}, dropped ${r.dropped})`)
  lines.push(`Leftover grey: ${r.leftover} combos left grey (${num(r.leftoverGrey / Math.max(r.leftover, 1))} each) · median peak pile ${r.medianPeakPile}`)
  lines.push(`Damage by source: openers ${pct(r.damage.opener / dmgTotal)}, counters ${pct(r.damage.counter / dmgTotal)}, throws ${pct(r.damage.throw / dmgTotal)}, enders ${pct(r.damage.ender / dmgTotal)}`)
  lines.push(`Game ends: ${Object.entries(r.routes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / r.games)}`).join(', ')}`)
  for (const k of [0, 1]) {
    const f = r.fighters[k], S = r.sides[k]
    const tot = Object.values(S.neutral).reduce((a, b) => a + b, 0) || 1
    const uses = [...f.cards.map(c => c.name), 'Guard', 'Duck', 'Step'].map(nm => {
      const parts = [`${pct((S.neutral[nm] || 0) / tot)}`]
      if (S.counter[nm]) parts.push(`counter ${S.counter[nm]}`)
      if (S.linker[nm]) parts.push(`link ${S.linker[nm]}`)
      if (S.ender[nm]) parts.push(`end ${S.ender[nm]}`)
      return `${nm} ${parts.join(' ')}`
    })
    lines.push(`${f.name} neutral plays: ${uses.join(' · ')}`)
  }
  return lines
}
