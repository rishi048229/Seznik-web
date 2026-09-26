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

Run git/PM2 as the **`ubuntu`** user (not `root`). If you see **dubious ownership** after cloning or fixing files as root:

```bash
sudo chown -R ubuntu:ubuntu /home/ubuntu/inventort-seznik
sudo -u ubuntu -i
```

Never run `npm` or `pm2` from `/root` — there is no `package.json` or `ecosystem.config.js` there.

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

Or as **ubuntu** (one script, correct paths):

```bash
bash /home/ubuntu/inventort-seznik/backend/scripts/ec2-deploy-ubuntu.sh
```

Or from the repo root:

```bash
bash backend/scripts/deploy.sh
```

(`deploy.sh` / `ec2-deploy-ubuntu.sh` pull **`dev`**, run additive SQL, build, and reload PM2 from **`backend/ecosystem.config.js`**.)

## Env file location

Backend loads `.env` from (in order): `backend/.env`, repo root `.env`, then  
`/home/ubuntu/inventort-seznik/backend/.env` on EC2. Legacy `/home/ubuntu/Seznik-web/...` is still tried for older servers.

## Mobile APK and OTA (frontend-only updates)

Production API URL is set in `mobile-inventory/eas.json` (`EXPO_PUBLIC_API_URL`).

1. **Install a release APK** that includes `expo-updates` (versionCode **12+**, channel **production**). Rebuild the APK when native deps or `runtimeVersion` / app version change.
2. **Ship JS/UI fixes without a new APK** from your dev machine (logged into Expo as `rishi048229`):

```bash
cd mobile-inventory
npm run update:production -- --message "Describe the change"
```

Devices on channel **production** check for updates on launch and reload when a bundle is available.

See `mobile-inventory/docs/OTA.md` for details.
