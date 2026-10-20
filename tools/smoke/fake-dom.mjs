// Just enough of the DOM for Preact to render and for tests to click and type.

class Node {
  constructor(nodeType, nodeName) { this.nodeType = nodeType; this.nodeName = nodeName; this.childNodes = []; this.parentNode = null }
  get firstChild() { return this.childNodes[0] || null }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null }
  get previousSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) - 1] || null }
  appendChild(c) { return this.insertBefore(c, null) }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c)
    const i = ref ? this.childNodes.indexOf(ref) : -1
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c)
    c.parentNode = this; return c
  }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c }
  replaceChild(n, o) { this.insertBefore(n, o); return this.removeChild(o) }
  remove() { if (this.parentNode) this.parentNode.removeChild(this) }
  contains(n) { while (n) { if (n === this) return true; n = n.parentNode } return false }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(c => c.textContent).join('') }
  set textContent(v) { this.childNodes = []; if (v !== '' && v != null) this.appendChild(new Text(String(v))) }
}
class Text extends Node {
  constructor(d) { super(3, '#text'); this.data = d }
  get nodeValue() { return this.data } set nodeValue(v) { this.data = v }
}
class Style {
  setProperty(k, v) { this[k] = v } removeProperty(k) { delete this[k] }
  set cssText(v) { this._css = v } get cssText() { return this._css || '' }
}
const EVENTS = ['onclick', 'oninput', 'onchange', 'ontoggle', 'onsubmit', 'onkeydown', 'onfocus', 'onblur']
class Element extends Node {
  constructor(tag) {
    super(1, tag.toUpperCase()); this.localName = tag; this.tagName = tag.toUpperCase()
    this.attributes = {}; this.style = new Style(); this.l = {}; this._listeners = {}
    this.value = ''; this.checked = false; this.disabled = false; this.open = false
  }
  setAttribute(k, v) { this.attributes[k] = String(v) }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null }
  removeAttribute(k) { delete this.attributes[k] }
  hasAttribute(k) { return k in this.attributes }
  addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn) }
  removeEventListener(t, fn) { this._listeners[t] = (this._listeners[t] || []).filter(f => f !== fn) }
  dispatch(type, extra = {}) {
    const e = { type, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...extra }
    for (let n = this; n; n = n.parentNode) {
      e.currentTarget = n
      for (const fn of (n._listeners?.[type] || [])) fn.call(n, e)
    }
  }
  get className() { return this.attributes.class || '' }
  focus() {} blur() {}
}
for (const k of EVENTS) Element.prototype[k] = null

export function installDom() {
  const body = new Element('body')
  const document = {
    body, documentElement: new Element('html'),
    createElement: t => new Element(t),
    createElementNS: (_, t) => new Element(t),
    createTextNode: t => new Text(String(t)),
    getElementById: id => find(body, n => n.attributes?.id === id),
  }
  globalThis.document = document
  globalThis.window = globalThis
  const store = new Map()
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
  globalThis.location = { hash: '' }
  return document
}

export function all(root, pred, out = []) {
  for (const c of root.childNodes) { if (c.nodeType === 1) { if (pred(c)) out.push(c); all(c, pred, out) } }
  return out
}
export const find = (root, pred) => all(root, pred)[0] || null
export const byText = (root, tag, text) => all(root, n => n.localName === tag && n.textContent.trim().includes(text))
export const cls = (n, c) => (n.attributes.class || '').split(/\s+/).includes(c)
