#!/bin/bash
# The both-act runs (22-23 Nov). One background script; writes JSON summaries only (no game logs).
#   bash docs/sim/bothact-22nov/run.sh  (from the repo root)
cd "$(dirname "$0")/../../.."
O=docs/sim/bothact-22nov; mkdir -p $O
log() { echo "$(date +%H:%M:%S) $*" >> $O/progress.txt; }
measure() { # edition tag [sets...]
  local ed=$1 tag=$2; shift 2; local S=""; for s in "$@"; do S="$S --set $s"; done
  log "$tag: turns"
  node tools/turns.mjs --edition $ed brawler zoner -n 600 --seed 5 $S --json $O/${tag}_bz.json > /dev/null &
  node tools/turns.mjs --edition $ed zoner brawler -n 600 --seed 6 $S --json $O/${tag}_zb.json > /dev/null &
  wait
  node tools/turns.mjs --pool $O/${tag}_bz.json,$O/${tag}_zb.json --json $O/${tag}_pool.json > $O/${tag}_pool.txt
  log "$tag: nod/odg ladder"
  node tools/luck.mjs --edition $ed rangetest brawler zoner --kinds nod0,nod1,odg0,odg1 -n 300 --seed 5 $S --json > $O/ladder_${tag}_bz.json &
  node tools/luck.mjs --edition $ed rangetest zoner brawler --kinds nod0,nod1,odg0,odg1 -n 300 --seed 6 $S --json > $O/ladder_${tag}_zb.json &
  wait
  log "$tag: Hard v Medium"
  node tools/luck.mjs --edition $ed rangetest brawler zoner --kinds lvl:medium0,lvl:medium1 -n 150 --seed 7 $S --json > $O/medium_${tag}_bz.json &
  node tools/luck.mjs --edition $ed rangetest zoner brawler --kinds lvl:medium0,lvl:medium1 -n 150 --seed 8 $S --json > $O/medium_${tag}_zb.json &
  wait
  node $O/summarise.mjs $O $tag > $O/summary_${tag}.json
  log "$tag: done"
}
rm -f $O/progress.txt $O/ALLDONE
log start
# Step 1: the candidate on v23tp2's partner
measure v23ba ba
# Step 2: one refit round
log "refit: recording"
rm -rf /tmp/fits/v23ba-A /tmp/fits/v23ba-B /tmp/fits/v23ba-pool
bash tools/record-bz.sh v23ba A 11 12 13 && bash tools/record-bz.sh v23ba B 21 22 23
mkdir -p /tmp/fits/v23ba-pool
for f in /tmp/fits/v23ba-A/r_*.json; do cp $f /tmp/fits/v23ba-pool/r_A_$(basename $f | cut -c3-); done
for f in /tmp/fits/v23ba-B/r_*.json; do cp $f /tmp/fits/v23ba-pool/r_B_$(basename $f | cut -c3-); done
python3 tools/fit.py /tmp/fits/v23ba-pool tools/fit-weights-v23ba1.json > $O/fit_v23ba1.txt 2>&1
python3 tools/prices.py /tmp/fits/v23ba-A /tmp/fits/v23ba-B > $O/prices_v23ba1.txt 2>&1
python3 - <<'PY'
import json, shutil, os
os.makedirs('data/v23ba1', exist_ok=True)
for f in ('brawler.json', 'zoner.json'): shutil.copy(f'data/v23ba/{f}', f'data/v23ba1/{f}')
s = json.load(open('data/v23ba/settings.json')); w = json.load(open('tools/fit-weights-v23ba1.json'))
s['ai']['fit'] = {k: round(v, 4) for k, v in w.items()}
s['ai']['fitNote'] = 'v23ba1 (23 Nov): the both-act candidate, one refit round (record-bz A 11-13, B 21-23, pooled)'
json.dump(s, open('data/v23ba1/settings.json', 'w'), indent=1)
PY
log "refit: done"
measure v23ba1 ba1
# Step 3, only if swing fails the pass bar (18%)
if node -e "const r=require('./$O/ba1_pool.json').report; process.exit(r.swing >= 0.18 ? 0 : 1)"; then
  measure v23ba1 ba1nmo noMoveOd=true
else log "step 3 skipped: swing under 18%"; fi
log all done
touch $O/ALLDONE
