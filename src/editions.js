// Which fighters a published page bundles. Each edition is its own page, with
// its own saved edits, settings and playtest log.
//
//   node tools/build-artifact.mjs                 -> dist/yomi-playtest.html      (rules v11 and v12)
//   node tools/build-artifact.mjs --edition v15   -> dist/yomi-playtest-v15.html  (rules v15)
//   node tools/build-artifact.mjs --edition v16   -> dist/yomi-playtest-v16.html  (rules v16: decks, combos, statuses)
//   node tools/build-artifact.mjs --edition v18   -> dist/yomi-playtest-v18.html  (rules v18: one deck, riders, the time-out)
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
    reference: [['v15', 'benchmark'], ['v15', 'benchmark-c34'], ['v15', 'benchmark-split']],
    drafts: [],
    labels: { 'signed-off': 'Untuned port' },
    defaultSides: ['benchmark', 'benchmark'],
  },
  v16: {
    title: 'Yomi Playtest v16', subtitle: 'rules v16', out: 'yomi-playtest-v16.html', settings: 'v16/settings.json',
    fighters: [],
    reference: [['v16', 'benchmark']],
    drafts: [['v16', 'warden']],
    labels: {},
    defaultSides: ['benchmark16', 'benchmark16'],
  },
  v18: {
    title: 'Yomi Playtest v18', subtitle: 'rules v18', out: 'yomi-playtest-v18.html', settings: 'v18/settings.json',
    fighters: [],
    reference: [['v18', 'benchmark']],
    drafts: [['v18', 'warden'], ['v18', 'vex'], ['v18', 'bastion'], ['v18', 'atlas']],
    labels: {},
    defaultSides: ['benchmark18', 'benchmark18'],
  },
  // v19 test (8 Nov): v18 with Counters only on Pressures and the grey cap (9)
  v19: {
    title: 'Yomi Playtest v19 test', subtitle: 'rules v18 + v19 test: Counters on Pressures, overflow grey cap, Converts cash only on a win, two combo lines', out: 'yomi-playtest-v19.html', settings: 'v19/settings.json',
    fighters: [],
    reference: [['v19', 'benchmark']],
    drafts: [['v19', 'warden'], ['v19', 'vex'], ['v19', 'bastion'], ['v19', 'atlas']],
    labels: {},
    defaultSides: ['benchmark19', 'benchmark19'],
  },
  // v20 (9 Nov, Mark): heat. v19's rules, with the tokens as your own power: your heat, your cap, past it straight
  // damage; no meter (specials 3 heat, the Super your whole cap, bought at the end of a round); core Recall x3, Read x3
  v20: {
    title: 'Yomi Playtest v20', subtitle: 'rules v20: heat (Pressure, Break, Guard)', out: 'yomi-playtest-v20.html', settings: 'v20/settings.json',
    fighters: [],
    reference: [['v20', 'benchmark']],
    drafts: [['v20', 'warden'], ['v20', 'vex'], ['v20', 'bastion'], ['v20', 'atlas']],
    labels: {},
    defaultSides: ['benchmark20', 'benchmark20'],
  },
  v17: {
    title: 'Yomi Playtest v17', subtitle: 'rules v17', out: 'yomi-playtest-v17.html', settings: 'v17/settings.json',
    fighters: [],
    reference: [['v17', 'benchmark']],
    drafts: [['v17', 'warden']],
    labels: {},
    defaultSides: ['benchmark17', 'benchmark17'],
  },
}
