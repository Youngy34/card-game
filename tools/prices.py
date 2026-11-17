"""prices.py <dir> [<dir>...] : pooled fit (full model, as tools/fit.py, plus fighter column) and a reduced model
with fewer, less collinear features. Prints prices in HP."""
import json, glob, sys, numpy as np
from sklearn.linear_model import LogisticRegression
X, y = [], []
for d in sys.argv[1:]:
    for f in sorted(glob.glob(f'{d}/r_*.json')):
        D = json.loads(open(f).read().splitlines()[0]); keys = D['keys']; s = 1 if '_bz' in f else -1
        for x, r in D['rows']:
            if r == 0.5: continue
            X.append(x + [s]); y.append(int(r == 1))
keys = keys + ['fighter']; X = np.array(X, float); y = np.array(y)
def fit(cols):
    A = X[:, [keys.index(c) for c in cols]]
    A2, y2 = np.vstack([A, -A]), np.concatenate([y, 1 - y])
    m = LogisticRegression(fit_intercept=False, C=10.0, max_iter=3000).fit(A2, y2)
    w = dict(zip(cols, m.coef_[0])); return w
full = ['hp','charge','full','nP','nC','nR','counter','starter','combo','knockdown','deck','init','home','dead','movers','fighter']
w = fit(full)
print(f'{len(y)} positions')
print('FULL  ' + ' '.join(f'{k}={w[k]/w["hp"]:+.2f}' for k in full if k not in ('hp','fighter')))
# reduced: total cards in hand instead of by type and icons
cards = X[:, keys.index('nP')] + X[:, keys.index('nC')] + X[:, keys.index('nR')]
X = np.hstack([X, cards[:, None]]); keys = keys + ['cards']
red = ['hp','charge','cards','knockdown','init','home','dead','fighter']
w = fit(red)
print('REDUC ' + ' '.join(f'{k}={w[k]/w["hp"]:+.2f}' for k in red if k not in ('hp','fighter')))
mid = ['hp','charge','nP','nC','nR','knockdown','init','home','dead','fighter']
w = fit(mid)
print('TYPES ' + ' '.join(f'{k}={w[k]/w["hp"]:+.2f}' for k in mid if k not in ('hp','fighter')))
