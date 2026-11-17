// A stand-in for Preact, its hooks and htm, for render smoke tests where the real libraries aren't available
// (no network). It runs every component function and turns the tree into plain text, so a render that throws, or
// text that should appear and doesn't, is caught. It doesn't diff, keep state or fire events: useState returns its
// initial value, effects never run.

export const Fragment = props => props.children
export function h(type, props, ...children) { return { type, props: props || {}, children } }

// ---- a small htm: parses the template into h() calls
const PH = i => `\u0001${i}\u0002`
export function htm(strings, ...values) {
  const src = strings.reduce((a, s, i) => a + s + (i < values.length ? PH(i) : ''), '')
  let pos = 0
  const val = tok => { const m = /^\u0001(\d+)\u0002$/.exec(tok); return m ? values[+m[1]] : undefined }
  const isPH = tok => /^\u0001\d+\u0002$/.test(tok)
  const textParts = t => {
    const out = []
    const re = /\u0001(\d+)\u0002/g
    let last = 0, m
    while ((m = re.exec(t))) { if (m.index > last) out.push(t.slice(last, m.index)); out.push(values[+m[1]]); last = re.lastIndex }
    if (last < t.length) out.push(t.slice(last))
    return out.filter(x => !(typeof x === 'string' && /^\s*$/.test(x) && x.includes('\n')))
  }
  const attrValue = raw => {
    if (isPH(raw)) return val(raw)
    const parts = textParts(raw)
    return parts.length === 1 ? parts[0] : parts.map(p => (p == null ? '' : String(p))).join('')
  }
  function parseChildren(closeCheck) {
    const kids = []
    while (pos < src.length) {
      if (src.startsWith('<!--', pos)) { const e = src.indexOf('-->', pos); pos = e < 0 ? src.length : e + 3; continue }
      if (src[pos] === '<' && src[pos + 1] === '/') {              // a closing tag: </div>, <//>, </${X}>
        const e = src.indexOf('>', pos); pos = e + 1
        if (closeCheck) return kids
        continue
      }
      if (src[pos] === '<') { kids.push(parseElement()); continue }
      let e = src.indexOf('<', pos); if (e < 0) e = src.length
      kids.push(...textParts(src.slice(pos, e)))
      pos = e
    }
    return kids
  }
  function parseElement() {
    pos++                                                        // '<'
    const m = /^(\u0001\d+\u0002|[A-Za-z][\w.-]*)/.exec(src.slice(pos))
    if (!m) throw new Error('mini-htm: bad tag at ' + src.slice(pos, pos + 30))
    pos += m[0].length
    const type = isPH(m[0]) ? val(m[0]) : m[0]
    const props = {}
    for (;;) {
      while (/\s/.test(src[pos])) pos++
      if (src.startsWith('/>', pos)) { pos += 2; return h(type, props) }
      if (src[pos] === '>') { pos++; break }
      if (src.startsWith('...', pos)) {
        pos += 3; const t = /^\u0001\d+\u0002/.exec(src.slice(pos))[0]; pos += t.length; Object.assign(props, val(t)); continue
      }
      const nm = /^[^\s=/>]+/.exec(src.slice(pos))
      if (!nm) throw new Error('mini-htm: bad attribute at ' + src.slice(pos, pos + 30))
      pos += nm[0].length
      if (src[pos] !== '=') { props[nm[0]] = true; continue }
      pos++
      let raw
      if (src[pos] === '"' || src[pos] === "'") { const q = src[pos]; const e = src.indexOf(q, pos + 1); raw = src.slice(pos + 1, e); pos = e + 1 }
      else { const v = /^[^\s/>]+/.exec(src.slice(pos))[0]; raw = v; pos += v.length }
      props[nm[0]] = attrValue(raw)
    }
    const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link'])
    if (typeof type === 'string' && VOID.has(type)) return h(type, props)
    const kids = parseChildren(true)
    return h(type, props, ...kids)
  }
  const out = parseChildren(false)
  return out.length === 1 ? out[0] : out
}

// ---- hooks: no state, no effects
export const hooks = {
  useState: init => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useMemo: f => f(),
  useRef: init => ({ current: init }),
  useCallback: f => f,
}

// ---- render to text, running every component
export function renderText(node) {
  const out = []
  const walk = n => {
    if (n == null || n === false || n === true) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return }
    if (typeof n.type === 'function') { walk(n.type({ ...n.props, children: n.children.length === 1 ? n.children[0] : n.children })); return }
    if (n.props && typeof n.props.title === 'string') out.push(`[${n.props.title}]`)
    walk(n.children)
    out.push(' ')
  }
  walk(node)
  return out.join('').replace(/\s+/g, ' ')
}
export const render = () => {}
