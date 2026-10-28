// UI library globals: Preact, its hooks and htm, loaded by index.html from a CDN.
// htm gives JSX-like templates with no build step: html`<div class=${x}>...</div>`.

const P = globalThis.preact
const H = globalThis.preactHooks

export const h = P.h
export const render = P.render
export const Fragment = P.Fragment
export const useState = H.useState
export const useEffect = H.useEffect
export const useMemo = H.useMemo
export const useRef = H.useRef
export const useCallback = H.useCallback
export const html = globalThis.htm.bind(P.h)

export const cx = (...a) => a.filter(Boolean).join(' ')
export const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`
