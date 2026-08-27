#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 STARTING SEZNIK BACKEND AWS DEPLOYMENT"
echo "=========================================="

# Navigate to project root if script is inside backend/scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$BACKEND_DIR"

echo "📥 1. Pulling latest main branch code..."
git pull origin main

echo "📦 2. Installing production dependencies..."
npm ci --only=production

echo "⚙️ 3. Generating Prisma ORM Client..."
npx prisma generate

echo "🗄️ 4. Applying additive schema (never drops data)..."
npx prisma db execute --file prisma/ensure-additive-columns.sql || echo "additive SQL skipped"
CI=true npx prisma db push || echo "db push skipped"

echo "🔨 5. Compiling TypeScript to JavaScript..."
npm run build

echo "⚡ 6. Zero-Downtime Reload with PM2..."
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETE & BACKEND IS LIVE!"
echo "=========================================="
