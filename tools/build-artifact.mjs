// Packs the app into one self-contained page for publishing as a claude.ai
// artifact: styles inlined, the bundled fighters inlined, and the app's own
// modules joined into a single script. Preact and htm still load from the CDN.
//
//   node tools/build-artifact.mjs        -> dist/yomi-playtest.html
//
// The modules are plain ES modules (see index.html for running them as-is).
// This joiner handles the import/export forms the app uses: named and
// namespace imports from relative paths, and `export function/const/{...}`.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const rel = p => path.relative(root, p).split(path.sep).join('/')
const mods = new Map()

function load(file) {
  const key = rel(file)
  if (mods.has(key)) return key
  mods.set(key, null)
  let src = fs.readFileSync(file, 'utf8')
  const deps = [], exportsList = []
  src = src.replace(/import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"];?/g, (_, what, spec) => {
    const dep = load(path.resolve(path.dirname(file), spec))
    deps.push(dep)
    what = what.trim()
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = __m[${JSON.stringify(dep)}];`
    if (what.startsWith('{')) return `const ${what.replace(/\s+as\s+/g, ': ')} = __m[${JSON.stringify(dep)}];`
    throw new Error(`${key}: unsupported import "${what}"`)
  })
  src = src.replace(/^export\s+(async\s+function|function)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => { exportsList.push(name); return `${kw} ${name}` })
  src = src.replace(/^export\s+(const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => { exportsList.push(name); return `${kw} ${name}` })
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => { names.split(',').map(s => s.trim()).filter(Boolean).forEach(n => exportsList.push(n)); return '' })
  if (/^\s*export\s/m.test(src)) throw new Error(`${key}: unsupported export form`)
  mods.set(key, { key, deps, src, exportsList })
  return key
}

const entry = load(path.join(root, 'src/main.js'))
const order = [], seen = new Set()
const visit = k => { if (seen.has(k)) return; seen.add(k); mods.get(k).deps.forEach(visit); order.push(k) }
visit(entry)

const fighters = {}
const ORDER = ['gambler', 'bastion', 'vex', 'atlas']
const REFERENCE = ['dummy']                 // benchmark fighters, from data/reference/
for (const id of ORDER) fighters[id] = JSON.parse(fs.readFileSync(path.join(root, `data/fighters/${id}.json`), 'utf8'))
for (const id of REFERENCE) fighters[id] = JSON.parse(fs.readFileSync(path.join(root, `data/reference/${id}.json`), 'utf8'))
const settings = JSON.parse(fs.readFileSync(path.join(root, 'data/settings.json'), 'utf8'))
const data = { fighters, order: [...ORDER, ...REFERENCE], reference: REFERENCE, settings, built: new Date().toISOString() }

let js = `window.__YOMI_DATA__ = ${JSON.stringify(data)};\n(function () {\n'use strict';\nconst __m = {};\n`
for (const k of order) {
  const m = mods.get(k)
  js += `// ---- ${k}\n__m[${JSON.stringify(k)}] = (function () {\n${m.src}\nreturn { ${m.exportsList.join(', ')} };\n})();\n`
}
js += '})();\n'
if (js.includes('</script')) throw new Error('script contains </script')

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const between = (a, b) => html.slice(html.indexOf(a) + a.length, html.indexOf(b))
const css = fs.readFileSync(path.join(root, 'src/app/styles.css'), 'utf8')
const head = between('<!--HEAD-->', '<!--/HEAD-->').replace(/<link rel="stylesheet" href="src\/app\/styles.css">\n?/, '')
const body = between('<!--BODY-->', '<!--/BODY-->')
const page = `<title>Yomi Playtest</title>
<meta name="claude:viewport-fit-sides" content="cover">
${head.trim()}
<style>
${css}
</style>
${body.trim()}
<script>
${js}</script>
`
fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
fs.writeFileSync(path.join(root, 'dist/yomi-playtest.html'), page)
console.log(`dist/yomi-playtest.html: ${(page.length / 1024).toFixed(0)} KB, ${order.length} modules`)
