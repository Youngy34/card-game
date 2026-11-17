"""Fit the partner's value weights to outcomes (luck plan, 13 Nov).

    python3 tools/fit.py <dir of record JSON files> <out.json>

Each record file holds rows of (feature differences, side 0's result) at the end of each clash, from
`node tools/luck.mjs record <a> <b>`. A logistic regression with no intercept, on each row and its mirror
(features negated, result flipped), gives a weight per feature in win-chance log-odds. Divided by the HP
weight, each is that feature's worth in HP. Games, not positions, are held out for the check.
"""
import json, glob, sys, math
import numpy as np
from sklearn.linear_model import LogisticRegression

src, out = sys.argv[1], sys.argv[2]
X, y, g = [], [], []
keys = None
for gi, f in enumerate(sorted(glob.glob(f'{src}/r_*.json'))):
    d = json.loads(open(f).read().splitlines()[0]); keys = d['keys']
    for x, r in d['rows']:
        if r == 0.5: continue
        X.append(x); y.append(int(r == 1)); g.append(f'{f}')
X = np.array(X, float); y = np.array(y)
print(f'{len(y)} positions from {len(set(g))} matchups')

# hold out every fifth matchup file's last 20% of rows as a rough check (rows are in game order)
idx = np.arange(len(y)); test = idx % 5 == 0
def mirror(A, b): return np.vstack([A, -A]), np.concatenate([b, 1 - b])
Xtr, ytr = mirror(X[~test], y[~test])
m = LogisticRegression(fit_intercept=False, C=10.0, max_iter=2000).fit(Xtr, ytr)
w = dict(zip(keys, m.coef_[0]))
p = m.predict_proba(X[test])[:, 1]
ll = -np.mean(y[test] * np.log(p) + (1 - y[test]) * np.log(1 - p))
acc = np.mean((p > 0.5) == y[test])
print(f'held-out: log-loss {ll:.3f}, accuracy {100*acc:.1f}%')
hp = w['hp']
print('feature      log-odds   in HP')
for k in keys: print(f'{k:12s} {w[k]:8.3f} {w[k]/hp:8.2f}')

# the hand-tuned value, for comparison, on the same held-out positions: d = HP + 0.6*charge + 0.5*cards (approx.)
cards = X[:, keys.index('nP')] + X[:, keys.index('nC')] + X[:, keys.index('nR')] + X[:, keys.index('spec')]
d = X[:, keys.index('hp')] + 0.6 * X[:, keys.index('charge')] + 0.5 * cards + 1.5 * X[:, keys.index('superReady')] - 0.8 * X[:, keys.index('knockdown')] - 0.4 * X[:, keys.index('staggered')]
ph = 1 / (1 + np.exp(-0.22 * d[test]))
llh = -np.mean(y[test] * np.log(ph) + (1 - y[test]) * np.log(1 - ph))
print(f'hand-tuned on the same positions: log-loss {llh:.3f}, accuracy {100*np.mean((ph > 0.5) == y[test]):.1f}%')
json.dump({k: float(v) for k, v in w.items()}, open(out, 'w'), indent=1)
