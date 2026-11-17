#!/bin/bash
# The v23e and v23dr editions (17 Nov) use v23d's decks unchanged: copy them in after applying v23e.patch.
cd "$(dirname "$0")/.."
for e in v23e v23dr; do cp data/v23d/brawler.json data/v23d/zoner.json data/$e/; done
