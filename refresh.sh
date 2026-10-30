#!/bin/sh
# Redraws the Orochi commit map from the monorepo and pushes it if it changed.
# Usage: ./refresh.sh [monorepo checkout, default ~/Documents/goliath/sourcing]
set -e
cd "$(dirname "$0")"
git pull -q --rebase
node scripts/orochi-map.mjs --repo "${1:-$HOME/Documents/goliath/sourcing}" --out assets
if git diff --quiet -- assets; then
  echo "map unchanged"
else
  git add assets
  git commit -qm "Refresh the Orochi commit map"
  git push -q
  echo "pushed"
fi
