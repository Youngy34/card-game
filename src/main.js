// Entry point. Loads the bundled fighters (inlined in the published page, or
// fetched from data/ when running locally), connects to saved data and renders.

import { html, render } from './app/lib.js'
import { initData, connect } from './app/store.js'
import { App } from './app/app.js'

const ORDER = ['gambler', 'bastion', 'vex', 'atlas']
const REFERENCE = ['dummy']                 // benchmark fighters, from data/reference/
const DRAFTS = ['clarence']                 // rules v12 drafts, from data/drafts/

async function loadData() {
  if (globalThis.__YOMI_DATA__) return globalThis.__YOMI_DATA__
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json() })
  const fighters = {}
  for (const id of ORDER) fighters[id] = await get(`data/fighters/${id}.json`)
  for (const id of REFERENCE) fighters[id] = await get(`data/reference/${id}.json`)
  for (const id of DRAFTS) fighters[id] = await get(`data/drafts/${id}.json`)
  return { fighters, order: [...ORDER, ...REFERENCE, ...DRAFTS], reference: REFERENCE, drafts: DRAFTS, settings: await get('data/settings.json') }
}

function start(boot) {
  loadData().then(data => {
    initData(data)
    render(html`<${App} boot=${boot || {}} />`, document.getElementById('app'))
    connect()
  }, e => {
    document.getElementById('app').textContent = `Couldn't load the fighters: ${e.message}`
  })
}

const hot = globalThis.claude?.hot
if (hot?.ready) hot.ready(start)
else start(hot?.data ?? {})
