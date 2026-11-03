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

// Maximin when the game is one of several, equally likely, and only the column player knows
// which (the opponent knows their own hand; we've dealt K guesses at it). One row mix x for all
// of them, maximising the average over the games of the column player's best reply in each:
//
//   maximise  (1/K) sum_s t_s   s.t.  t_s <= sum_i x_i M_s[i][j]  for every game s and column j,
//             sum_i x_i <= 1,  x, t >= 0          (entries shifted to >= 1, so sum x = 1 at the optimum)
//
// Ms: K matrices with the same rows (their columns may differ). Returns { x, v, y }: our mix,
// the value, and y[s], the column player's reply mix in game s (the dual prices).
export function bayesMaximin(Ms) {
  const K = Ms.length, n = Ms[0].length
  let lo = Infinity
  for (const M of Ms) for (const row of M) for (const v of row) if (v < lo) lo = v
  const shift = 1 - lo
  const cons = []
  for (let s = 0; s < K; s++) for (let j = 0; j < Ms[s][0].length; j++) cons.push([s, j])
  const m = cons.length + 1, nv = n + K, W = nv + m + 1
  const T = cons.map(([s, j], r) => {
    const row = new Float64Array(W)
    for (let i = 0; i < n; i++) row[i] = -(Ms[s][i][j] + shift)
    row[n + s] = 1
    row[nv + r] = 1
    return row
  })
  const last = new Float64Array(W)
  for (let i = 0; i < n; i++) last[i] = 1
  last[nv + m - 1] = 1
  last[W - 1] = 1
  T.push(last)
  const obj = new Float64Array(W)
  for (let s = 0; s < K; s++) obj[n + s] = -1 / K
  const basis = Array.from({ length: m }, (_, r) => nv + r)
  const EPS = 1e-12
  for (let iter = 0; iter < 20000; iter++) {
    let col = -1
    for (let j = 0; j < W - 1; j++) if (obj[j] < -EPS) { col = j; break }     // Bland's rule
    if (col < 0) break
    let row = -1, best = Infinity
    for (let i = 0; i < m; i++) {
      const a = T[i][col]
      if (a > EPS) {
        const r = T[i][W - 1] / a
        if (r < best - EPS || (Math.abs(r - best) <= EPS && basis[i] < basis[row])) { best = r; row = i }
      }
    }
    if (row < 0) break
    const p = T[row][col]
    for (let j = 0; j < W; j++) T[row][j] /= p
    for (let i = 0; i < m; i++) {
      if (i === row) continue
      const f = T[i][col]
      if (f !== 0) for (let j = 0; j < W; j++) T[i][j] -= f * T[row][j]
    }
    const f = obj[col]
    for (let j = 0; j < W; j++) obj[j] -= f * T[row][j]
    basis[row] = col
  }
  let x = new Array(n).fill(0)
  basis.forEach((b, r) => { if (b < n) x[b] = Math.max(0, T[r][W - 1]) })
  const sx = x.reduce((a, b) => a + b, 0)
  x = sx > 0 ? x.map(v => v / sx) : x.map(() => 1 / n)
  const y = Ms.map(M => new Array(M[0].length).fill(0))
  cons.forEach(([s, j], r) => { y[s][j] = Math.max(0, obj[nv + r]) })
  for (const ys of y) { const t = ys.reduce((a, b) => a + b, 0); for (let j = 0; j < ys.length; j++) ys[j] = t > 0 ? ys[j] / t : 1 / ys.length }
  return { x, v: obj[W - 1] - shift, y }
}

// The same with both hands hidden: our hand is one of A (to the opponent, equally likely; ours is
// one of them) and theirs one of B. Ms[a][b] is the grid when we hold a and they hold b (rows
// differ with a, columns with b). We pick a mix x[a] for each hand we might hold; they reply for
// each hand they might hold, knowing our x but not which hand we have:
//
//   maximise  (1/B) sum_b t_b   s.t.  t_b <= (1/A) sum_a sum_i x[a]_i Ms[a][b][i][j]  for every b, j,
//             sum_i x[a]_i <= 1 for every a,  x, t >= 0          (entries shifted to >= 1)
//
// Returns { x, v, y }: x[a] our mix holding hand a, the value, y[b] their reply holding hand b.
export function bayesGame(Ms) {
  const A = Ms.length, B = Ms[0].length
  let lo = Infinity
  for (const Mr of Ms) for (const M of Mr) for (const row of M) for (const v of row) if (v < lo) lo = v
  const shift = 1 - lo
  const off = [], R = Ms.map(Mr => Mr[0].length)
  let nx = 0
  for (let a = 0; a < A; a++) { off.push(nx); nx += R[a] }
  const cons = []
  for (let b = 0; b < B; b++) for (let j = 0; j < Ms[0][b][0].length; j++) cons.push([b, j])
  const m = cons.length + A, nv = nx + B, W = nv + m + 1
  const T = cons.map(([b, j], r) => {
    const row = new Float64Array(W)
    for (let a = 0; a < A; a++) for (let i = 0; i < R[a]; i++) row[off[a] + i] = -(Ms[a][b][i][j] + shift) / A
    row[nx + b] = 1
    row[nv + r] = 1
    return row
  })
  for (let a = 0; a < A; a++) {
    const row = new Float64Array(W)
    for (let i = 0; i < R[a]; i++) row[off[a] + i] = 1
    row[nv + cons.length + a] = 1
    row[W - 1] = 1
    T.push(row)
  }
  const obj = new Float64Array(W)
  for (let b = 0; b < B; b++) obj[nx + b] = -1 / B
  const basis = Array.from({ length: m }, (_, r) => nv + r)
  const EPS = 1e-12
  for (let iter = 0; iter < 50000; iter++) {
    let col = -1
    for (let j = 0; j < W - 1; j++) if (obj[j] < -EPS) { col = j; break }     // Bland's rule
    if (col < 0) break
    let row = -1, best = Infinity
    for (let i = 0; i < m; i++) {
      const q = T[i][col]
      if (q > EPS) {
        const r = T[i][W - 1] / q
        if (r < best - EPS || (Math.abs(r - best) <= EPS && basis[i] < basis[row])) { best = r; row = i }
      }
    }
    if (row < 0) break
    const p = T[row][col]
    for (let j = 0; j < W; j++) T[row][j] /= p
    for (let i = 0; i < m; i++) {
      if (i === row) continue
      const f = T[i][col]
      if (f !== 0) for (let j = 0; j < W; j++) T[i][j] -= f * T[row][j]
    }
    const f = obj[col]
    for (let j = 0; j < W; j++) obj[j] -= f * T[row][j]
    basis[row] = col
  }
  const flat = new Array(nx).fill(0)
  basis.forEach((b, r) => { if (b < nx) flat[b] = Math.max(0, T[r][W - 1]) })
  const x = R.map((n, a) => {
    const xa = flat.slice(off[a], off[a] + n), s = xa.reduce((p, q) => p + q, 0)
    return s > 0 ? xa.map(v => v / s) : xa.map(() => 1 / n)
  })
  const y = Ms[0].map(M => new Array(M[0].length).fill(0))
  cons.forEach(([b, j], r) => { y[b][j] = Math.max(0, obj[nv + r]) })
  for (const yb of y) { const t = yb.reduce((p, q) => p + q, 0); for (let j = 0; j < yb.length; j++) yb[j] = t > 0 ? yb[j] / t : 1 / yb.length }
  return { x, v: obj[W - 1] - shift, y }
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
