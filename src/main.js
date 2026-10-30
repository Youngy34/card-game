// Entry point. Loads the bundled fighters (inlined in the published page, or
// fetched from data/ when running locally), connects to saved data and renders.

import { html, render } from './app/lib.js'
import { initData, connect } from './app/store.js'
import { App } from './app/app.js'
import { EDITIONS } from './editions.js'

// Running locally: the edition comes from the address (index.html?edition=v15)
async function loadData() {
  if (globalThis.__YOMI_DATA__) return globalThis.__YOMI_DATA__
  const key = new URLSearchParams(globalThis.location?.search || '').get('edition') || 'v11'
  const E = EDITIONS[key] || EDITIONS.v11
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json() })
  const fighters = {}, ids = {}
  for (const group of ['fighters', 'reference', 'drafts']) {
    ids[group] = []
    for (const [dir, file] of E[group]) { const f = await get(`data/${dir}/${file}.json`); fighters[f.id] = f; ids[group].push(f.id) }
  }
  return {
    fighters, order: [...ids.reference.filter(() => key !== 'v11'), ...ids.fighters, ...ids.reference.filter(() => key === 'v11'), ...ids.drafts],
    reference: ids.reference, drafts: ids.drafts, settings: await get(`data/${E.settings}`),
    edition: { key, title: E.title, subtitle: E.subtitle, labels: E.labels, defaultSides: E.defaultSides },
  }
}

function start(boot) {
  loadData().then(data => {
    initData(data)
    const el = document.getElementById('app')
    el.textContent = ''                      // drop the loading line, which Preact would otherwise leave behind
    render(html`<${App} boot=${boot || {}} />`, el)
    connect()
  }, e => {
    document.getElementById('app').textContent = `Couldn't load the fighters: ${e.message}`
  })
}

const hot = globalThis.claude?.hot
if (hot?.ready) hot.ready(start)
else start(hot?.data ?? {})
