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

## Push notifications (not the same as OTA)

- **OTA** = JavaScript/UI updates via Expo Updates.
- **Push alerts** (low stock, test button, remote print) need:
  1. **`expo-notifications`** in the APK (plugin in `app.json` — requires a **new native build** after adding it).
  2. User grants **Notifications** permission (Android 13+: `POST_NOTIFICATIONS`).
  3. **Login once** so the app registers an Expo push token with the backend.
  4. **FCM (Firebase)** for reliable remote push on standalone Android: add `google-services.json` via [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) (EAS Build handles this automatically; local Gradle APKs need FCM configured manually).

**Settings → Alerts → Test local** uses the device notification tray (works without FCM). **Test push** uses Expo’s servers and needs steps 1–4 above.

## EC2 backend

OTA does **not** deploy the API. Backend deploy: `DEPLOY_AWS.md` or `backend/scripts/ec2-deploy-ubuntu.sh` as user **ubuntu**.
