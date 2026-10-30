// Which fighters a published page bundles. Each edition is its own page, with
// its own saved edits, settings and playtest log.
//
//   node tools/build-artifact.mjs                 -> dist/yomi-playtest.html      (rules v11 and v12)
//   node tools/build-artifact.mjs --edition v15   -> dist/yomi-playtest-v15.html  (rules v15)
//
// Running locally: index.html, or index.html?edition=v15.
// Fighters are [folder under data/, file name]; the roster keys them by their id.

export const EDITIONS = {
  v11: {
    title: 'Yomi Playtest', subtitle: 'rules v11 and v12', out: 'yomi-playtest.html', settings: 'settings.json',
    fighters: [['fighters', 'gambler'], ['fighters', 'bastion'], ['fighters', 'vex'], ['fighters', 'atlas']],
    reference: [['reference', 'dummy']],
    drafts: [['drafts', 'clarence']],
    labels: {},
    defaultSides: ['gambler', 'bastion'],
  },
  v15: {
    title: 'Yomi Playtest v15', subtitle: 'rules v15', out: 'yomi-playtest-v15.html', settings: 'v15/settings.json',
    fighters: [['v15', 'vex'], ['v15', 'atlas'], ['v15', 'bastion'], ['v15', 'gambler']],
    reference: [['v15', 'benchmark'], ['v15', 'benchmark-split']],
    drafts: [],
    labels: { 'signed-off': 'Untuned port' },
    defaultSides: ['benchmark', 'benchmark'],
  },
}
