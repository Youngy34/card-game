#!/usr/bin/env python3
"""Records reference games from yomi_sim.py for the JavaScript cross-check.

Usage: python3 py_trace.py <path to folder with yomi_sim.py> <out.jsonl> [games per pairing]

Each round records both players' options, both payoff grids, both game
values, the cards played and the full board afterwards. Picks are half
uniform-random (to reach odd boards) and half the sim's own mixed strategy
(to reach realistic ones). The JS side replays the same picks.
"""
import sys, json, random, importlib.util
import numpy as np

spec = importlib.util.spec_from_file_location('yomi_sim', sys.argv[1] + '/yomi_sim.py')
ys = importlib.util.module_from_spec(spec); spec.loader.exec_module(ys)
out = open(sys.argv[2], 'w')
G = int(sys.argv[3]) if len(sys.argv) > 3 else 12

core = ['gambler', 'bastion', 'vex', 'atlas']
pairs = [(a, b) for i, a in enumerate(core) for b in core[i:]]
pairs += [('atlas-taunt', 'vex'), ('baseline', 'gambler'), ('gambler-rs', 'bastion'),
          ('gambler-rs-empty', 'atlas'), ('baseline', 'baseline'), ('atlas-taunt', 'gambler-rs'),
          ('bastion-sc2', 'vex-22'), ('atlas-23', 'gambler-pact'), ('gambler-noself', 'bastion-22'),
          ('gambler-cap4', 'vex-full'), ('atlas-bb4', 'bastion-sc2'), ('gambler-pact', 'gambler-pact'),
          ('vex-full', 'atlas-23')]

def enc(o): return 'S' if o == 'S' else int(o)
def state(X): return dict(hp=X.hp, pile=X.pile, hand=sorted(X.hand), cd1=list(X.cd1), cd2=list(X.cd2),
                          sup=X.sup, tlock=X.tlock)

rng = random.Random(20261020)
for mode in (False, 'strict', 'attack'):
    ys.RULES['counter_chip'] = mode
    for (na, nb) in pairs:
        fa, fb = ys.ROSTER[na](), ys.ROSTER[nb]()
        for g in range(G if mode is False else max(2, G // 4)):
            A, B = ys.Player(fa), ys.Player(fb)
            rounds = []
            for n in range(60):
                oa, ob = A.options(), B.options()
                MA = np.zeros((len(oa), len(ob))); MB = np.zeros_like(MA); nxt = {}
                for i, a in enumerate(oa):
                    for j, b in enumerate(ob):
                        A2, B2, res, rr, q = ys.step(A, B, a, b); nxt[i, j] = (A2, B2, res, rr, q)
                        MA[i, j] = ys.value(A2, B2, res, A2); MB[i, j] = ys.value(A2, B2, res, B2)
                x = ys.maximin(MA); y = ys.maximin(1 - MB.T)
                vA = float(min(MA.T @ x)); vB = float(min((1 - MB.T).T @ y))
                if rng.random() < 0.5:
                    i, j = rng.randrange(len(oa)), rng.randrange(len(ob))
                else:
                    i = int(np.searchsorted(np.cumsum(x), rng.random() * x.sum()))
                    j = int(np.searchsorted(np.cumsum(y), rng.random() * y.sum()))
                    i, j = min(i, len(oa) - 1), min(j, len(ob) - 1)
                A2, B2, res, rr, q = nxt[i, j]
                rounds.append(dict(oa=[enc(o) for o in oa], ob=[enc(o) for o in ob],
                                   MA=MA.round(12).tolist(), MB=MB.round(12).tolist(), vA=vA, vB=vB,
                                   a=enc(oa[i]), b=enc(ob[j]), result=res, resolved=list(rr), quiet=q,
                                   A=state(A2), B=state(B2)))
                A, B = A2, B2
                if res is not None: break
            out.write(json.dumps(dict(mode=mode or 'always', a=na, b=nb, rounds=rounds)) + '\n')
out.close()
print('wrote', sys.argv[2])
