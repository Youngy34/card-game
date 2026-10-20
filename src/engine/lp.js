// Maximin for small zero-sum matrix games, by the simplex method.
//
// maximin(M) returns { x, v }: the row player's mixed strategy that maximises
// the worst-case payoff of M (rows = our options, columns = theirs), and the
// value of the game. Same job as scipy's linprog in yomi_sim.py. When several
// strategies are optimal the two solvers may pick different ones; the value
// is always the same.

export function maximin(M) {
  const n = M.length, m = M[0].length
  // Shift so every entry is at least 1 (payoffs here are win chances in [0, 1]).
  let lo = Infinity
  for (const row of M) for (const v of row) if (v < lo) lo = v
  const shift = 1 - lo
  // Column player's LP:  maximise sum(y)  s.t.  M' y <= 1,  y >= 0.
  // Tableau: n constraint rows, columns = m vars + n slacks + rhs.
  const W = m + n + 1
  const T = []
  for (let i = 0; i < n; i++) {
    const row = new Float64Array(W)
    for (let j = 0; j < m; j++) row[j] = M[i][j] + shift
    row[m + i] = 1
    row[W - 1] = 1
    T.push(row)
  }
  const obj = new Float64Array(W)
  for (let j = 0; j < m; j++) obj[j] = -1
  const basis = Array.from({ length: n }, (_, i) => m + i)
  const EPS = 1e-12
  for (let iter = 0; iter < 500; iter++) {
    // Bland's rule: lowest-index column with a negative reduced cost
    let col = -1
    for (let j = 0; j < W - 1; j++) if (obj[j] < -EPS) { col = j; break }
    if (col < 0) break
    let row = -1, best = Infinity
    for (let i = 0; i < n; i++) {
      const a = T[i][col]
      if (a > EPS) {
        const r = T[i][W - 1] / a
        if (r < best - EPS || (Math.abs(r - best) <= EPS && basis[i] < basis[row])) { best = r; row = i }
      }
    }
    if (row < 0) break                                  // unbounded: can't happen here
    const p = T[row][col]
    for (let j = 0; j < W; j++) T[row][j] /= p
    for (let i = 0; i < n; i++) {
      if (i === row) continue
      const f = T[i][col]
      if (f !== 0) for (let j = 0; j < W; j++) T[i][j] -= f * T[row][j]
    }
    const f = obj[col]
    for (let j = 0; j < W; j++) obj[j] -= f * T[row][j]
    basis[row] = col
  }
  // Row player's strategy = the dual prices, read off the slack columns.
  const u = []
  let s = 0
  for (let i = 0; i < n; i++) { const d = Math.max(0, obj[m + i]); u.push(d); s += d }
  const x = s > 0 ? u.map(d => d / s) : u.map(() => 1 / n)
  return { x, v: 1 / obj[W - 1] - shift }
}

// Worst case for the row player of strategy x against M
export function worstCase(M, x) {
  let w = Infinity
  for (let j = 0; j < M[0].length; j++) {
    let s = 0
    for (let i = 0; i < M.length; i++) s += x[i] * M[i][j]
    if (s < w) w = s
  }
  return w
}
