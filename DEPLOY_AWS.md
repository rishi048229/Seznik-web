# AWS EC2 backend (inventort-seznik)

Production/staging API on EC2 is deployed from **[inventort-seznik](https://github.com/rishi048229/inventort-seznik)** — **not** the old `Seznik-web` clone path.

## One-time server setup

```bash
cd /home/ubuntu
git clone https://github.com/rishi048229/inventort-seznik.git
cd inventort-seznik/backend
cp .env.example .env   # or copy your existing DATABASE_URL, JWT_SECRET, etc.
# Edit .env — DATABASE_URL must point at RDS
npm ci
npx prisma generate
node scripts/ensure-additive-columns.cjs
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

Set GitHub Actions secret **`AWS_APP_DIR`** to `/home/ubuntu/inventort-seznik` if the repo is not at that path.

## Critical: never `prisma db push --accept-data-loss` on live RDS

That command **drops columns and tables** to match schema drift. On production it can delete KOT orders, print jobs, settings columns (`upiId`, `businessType`), and more.

**Safe path only:**

```bash
node scripts/ensure-additive-columns.cjs
npm run build
pm2 reload ecosystem.config.js --env production
```

If you already ran destructive `db push`, **restore the RDS snapshot** from before that run, then deploy with the safe path above.

Run git/PM2 as the **`ubuntu`** user (not `root`) to avoid “dubious ownership” on `/home/ubuntu/Seznik-web`.

## Deploy after every `dev` push

```bash
cd /home/ubuntu/inventort-seznik
git fetch origin && git checkout dev && git pull origin dev
cd backend
npm ci
npx prisma generate
node scripts/ensure-additive-columns.cjs
npm run build
pm2 reload ecosystem.config.js --env production
pm2 save
```

Or from the repo root on the server:

```bash
bash backend/scripts/deploy.sh
```

(`deploy.sh` pulls **`dev`**, runs additive SQL, builds, and reloads PM2.)

## Env file location

Backend loads `.env` from (in order): `backend/.env`, repo root `.env`, then  
`/home/ubuntu/inventort-seznik/backend/.env` on EC2. Legacy `/home/ubuntu/Seznik-web/...` is still tried for older servers.

## Mobile APK

Build against the same API URL as `eas.json` production profile (`EXPO_PUBLIC_API_URL`). After UI changes, run a new release APK — OTA is off for native printer builds.
