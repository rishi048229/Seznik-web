# Seznik Support Portal

Standalone Vite + React app for customer support agents. Kept separate from `admin-panel`.

## Develop

```bash
cd support-panel
npm install
npm run dev
```

Opens on [http://localhost:5174](http://localhost:5174). Unauthenticated visitors land on `/login`.

Support agent accounts are created from the admin panel. Copy `DATABASE_URL` (and session secret) from `admin-panel/.env` into `support-panel/.env`.
