#!/usr/bin/env bash
# Run on EC2 as user ubuntu: bash /home/ubuntu/inventort-seznik/backend/scripts/ec2-deploy-ubuntu.sh
set -euo pipefail

REPO="${SEZNIK_REPO_DIR:-/home/ubuntu/inventort-seznik}"
BACKEND="$REPO/backend"

if [[ ! -d "$REPO/.git" ]]; then
  echo "Clone first: git clone https://github.com/rishi048229/inventort-seznik.git $REPO"
  exit 1
fi

cd "$REPO"
git fetch origin
git checkout dev
git pull origin dev

cd "$BACKEND"
npm ci
npx prisma generate
node scripts/ensure-additive-columns.cjs
npm run build

if pm2 describe seznik-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

echo "Deploy OK. Logs:"
pm2 logs seznik-backend --lines 20 --nostream
