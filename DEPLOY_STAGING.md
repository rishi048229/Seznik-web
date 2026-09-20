# Staging deploy (after main → dev merge)

Use this **before** merging `dev` into `main`. Production PostgreSQL must only receive **additive** SQL.

Env var names stay as they are (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `VITE_API_URL`).

## 0. Snapshot

- RDS / Postgres snapshot of the staging (then production) database
- Git tag on current `dev` if not already tagged: `pre-merge-dev-YYYYMMDD`

## 1. Backend (EC2)

```bash
cd /home/ubuntu/Seznik-web   # or the actual clone path
git fetch origin
git checkout dev
git pull origin dev

cd backend
npm ci
npx prisma generate
node scripts/ensure-additive-columns.cjs   # idempotent; safe to run twice
npm run build
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
```

Do **not** run `prisma migrate reset` or `DROP` statements.

`prisma db push` is already in `backend/scripts/deploy.sh` as a fallback; prefer the additive script first on a live DB.

## 2. Frontend (Vercel preview from `dev`)

- Push `dev` (when ready) and open a **Vercel preview** for `frontend/` — do not promote to production until soak is done.
- `VITE_API_URL` should point at the **staging** API, not live if you are still validating.

```bash
cd frontend
npm ci
npm run build
```

## 3. Mobile

Point the Expo/EAS build at the **same staging API** as web. Same JWT tenant (`ownerId` for agents).

## 4. Smoke checklist

- [ ] Register / login (email + phone OTP if enabled)
- [ ] Agent login sees admin store; restricted permissions hide routes
- [ ] Create a sale on web; same tenant sees it on mobile
- [ ] KOT create / cancel without revenue
- [ ] Daybook + dashboard load
- [ ] Utility kiosk CRUD
- [ ] Web thermal print VEER or DEV (QR/footer not cut off)
- [ ] Mobile Bluetooth print (at least one SEZNIK model)
- [ ] Public receipt `/receipt/:id`
- [ ] Sale return/exchange API
- [ ] Print-job create (if remote print enabled)

## 5. Rollback

- Backend: `git checkout` previous `dev` tag + `pm2 reload` (schema is additive — leftover columns are unused, not dropped)
- Frontend: revert Vercel to last production `main` deployment
- DB: restore snapshot only if the additive script somehow failed mid-statement (unlikely; statements are `IF NOT EXISTS`)

## 6. Promote to production

Only after a 24–48h staging soak:

1. Snapshot production DB
2. Run `ensure-additive-columns.cjs` on production
3. Deploy backend from `dev`
4. Merge `dev` → `main` (or promote the Vercel preview)
5. Ship mobile store builds against the production API URL
