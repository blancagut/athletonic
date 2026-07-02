#!/bin/zsh
# Monthly catalog refresh for Athletonic.
#
#   ./scripts/monthly-refresh.sh              # scrape + regenerate + deploy
#   ./scripts/monthly-refresh.sh --skip-scrape  # regenerate + deploy only
#
# What it does:
#   1. Re-scrapes all brand sources into output/data/products.db (fresh prices,
#      incl. Nike clearance prices — we match nike.com as authorized US
#      distributor).
#   2. Regenerates the full site in a CLEAN git worktree of origin/main so
#      local work-in-progress never leaks into the deploy.
#   3. Commits the regen and pushes to the working branch + main (Vercel
#      deploys main automatically).
#
# Schedule monthly, e.g.:  crontab -e
#   0 6 1 * * cd /Users/User/Desktop/Sups && ./scripts/monthly-refresh.sh >> output/logs/monthly-refresh.log 2>&1

set -euo pipefail

REPO_DIR="${0:a:h:h}"
BRANCH="fix/checkout-purchasable"
WORKTREE="$(mktemp -d /tmp/sups-refresh-XXXXXX)"
STAMP="$(date +%Y-%m-%d)"

cd "$REPO_DIR"

if [[ "${1:-}" != "--skip-scrape" ]]; then
  echo "[$STAMP] Scraping all brand sources…"
  .venv/bin/python main.py
fi

echo "[$STAMP] Regenerating site in clean worktree $WORKTREE…"
git fetch origin
rmdir "$WORKTREE"
git worktree add "$WORKTREE" origin/main
ln -sfn "$REPO_DIR/node_modules" "$WORKTREE/node_modules"
mkdir -p "$WORKTREE/output/data"
ln -sf "$REPO_DIR/output/data/products.db" "$WORKTREE/output/data/products.db"

cd "$WORKTREE"
npm run generate
npm run build:locales

if git status --porcelain | grep -q .; then
  git add -A
  git commit -m "Monthly catalog refresh $STAMP: re-scraped source prices + full site regeneration"
  git push origin "HEAD:$BRANCH"
  git push origin HEAD:main
  echo "[$STAMP] Deployed $(git rev-parse --short HEAD) to main."
else
  echo "[$STAMP] No catalog changes — nothing to deploy."
fi

cd "$REPO_DIR"
git worktree remove "$WORKTREE" --force
echo "[$STAMP] Done."
