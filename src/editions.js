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
  // v21 (10 Nov, Mark): v20 with nine Guards (Recall, Read, the fighter's own, three of each), two Guards do nothing,
  // 28-card decks, and three specials (one of each type) plus the Super on the table. Since the afternoon of 10 Nov
  // the page calls heat Charge (words: 'charge' in data/v21/settings.json); the v20 page keeps heat
  v21: {
    title: 'Yomi Playtest v21', subtitle: 'rules v21: Charge, nine Guards, three specials', out: 'yomi-playtest-v21.html', settings: 'v21/settings.json',
    fighters: [],
    reference: [['v21', 'benchmark']],
    drafts: [['v21', 'warden'], ['v21', 'vex'], ['v21', 'bastion'], ['v21', 'atlas']],
    labels: {},
    defaultSides: ['benchmark21', 'benchmark21'],
  },
  // v22 (13 Nov, Mark): range. The initiative token shows Close or Far; attacks reach Close, Far or both, and can't be
  // played out of reach; movers move the fight win or lose; at the end of a round you can pay 3 Charge to move it
  // instead of buying. Two test fighters: the Brawler (wants Close) and the Zoner (wants Far)
  v22: {
    title: 'Guardbreakers Playtest v22', subtitle: 'rules v22: range (Close and Far), moving with Charge', out: 'yomi-playtest-v22.html', settings: 'v22/settings.json',
    fighters: [],
    reference: [],
    drafts: [['v22', 'brawler'], ['v22', 'zoner']],
    labels: {},
    defaultSides: ['brawler22', 'zoner22'],
  },
  // v23 (16 Nov, Mark): Overdrive (+ the hit's Charge, 2 Charge), the exchange, Guards draw unless a Break beats them,
  // range endings (on hit / on block), lower Charge (caps 6 / 5, moving 2), no specials or Super. Edition data/v23d.
  v23: {
    title: 'Guardbreakers Playtest v23', subtitle: 'rules v23: Overdrive, the exchange, range endings', out: 'guardbreakers-playtest-v23.html', settings: 'v23d/settings.json',
    fighters: [],
    reference: [],
    drafts: [['v23d', 'brawler'], ['v23d', 'zoner']],
    labels: {},
    defaultSides: ['brawler23b', 'zoner23b'],
  },
  // v23, 17 Nov (Mark): the rules as written in claude/rules v23 complete.md. The new test fighters with their
  // abilities (Clinch, Zone), the knockdown (no end-of-round option, then lose every speed clash), EX Overdrive (turn
  // your fighter card sideways; win every speed clash), charge up, no exchange, and the time-out penalty (whoever's
  // deck runs out first loses 3 HP). Edition data/v23tp2 (second refit).
  v23tp: {
    title: 'Guardbreakers Playtest v23 (17 Nov)', subtitle: 'rules v23 as of 17 Nov: abilities, EX Overdrive, charge up, the time-out penalty', out: 'guardbreakers-playtest-v23-17nov.html', settings: 'v23tp2/settings.json',
    fighters: [],
    reference: [],
    drafts: [['v23tp2', 'brawler'], ['v23tp2', 'zoner']],
    labels: {},
    defaultSides: ['brawler-t', 'zoner-t'],
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
