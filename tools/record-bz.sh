#!/bin/bash
# record-bz.sh <edition> <setname> <seeds...> : B v Z both seat orders, 300 games each, explore 0.25
cd "$(dirname "$0")/.."
ed=$1; set=$2; shift 2
dir=/tmp/fits/$ed-$set; mkdir -p $dir
for s in "$@"; do
  node tools/luck.mjs --edition $ed record brawler zoner -n 300 --seed $s --explore 0.25 > $dir/r_bz$s.json &
  node tools/luck.mjs --edition $ed record zoner brawler -n 300 --seed $s --explore 0.25 > $dir/r_zb$s.json &
  wait
done
echo done > $dir/DONE
