# Seznik POS — Expo OTA (EAS Update)

## When you need a new APK vs OTA

| Change | Action |
|--------|--------|
| React/TS UI, screens, API client, assets in JS bundle | `npm run update:production -- --message "..."` |
| New native module, Expo SDK upgrade, `runtimeVersion` / app version bump | New release APK (or `eas build --profile production`) |

`runtimeVersion` uses **appVersion** (`1.0.x` in `app.json`). Bumping `expo.version` requires a new binary; OTA updates must match the installed runtime.

## One-time: install OTA-enabled APK

Build locally (prebuild + Gradle) or:

```bash
cd mobile-inventory
eas build --profile production --platform android
```

Install the APK on store devices. Channel must be **production** (set in `eas.json` and `app.json` → `updates.requestHeaders`).

## Publish a frontend update

```bash
cd mobile-inventory
npm run update:production -- --message "Printers QR toggle fix" --non-interactive
```

Requires [EAS CLI](https://docs.expo.dev/eas-update/getting-started/) and `eas login` as project owner.

## Verify

- Kill and reopen the app twice (first launch may download; second applies).
- Expo dashboard → project **seznik-app** → Updates.

## EC2 backend

OTA does **not** deploy the API. Backend deploy: `DEPLOY_AWS.md` or `backend/scripts/ec2-deploy-ubuntu.sh` as user **ubuntu**.
