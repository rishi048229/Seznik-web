# Conflicts resolved: `origin/main` into `dev`

Merge direction: **main → dev** (production web into the mobile/backend line).  
Do **not** promote `dev` → `main` until staging smoke tests in `DEPLOY_STAGING.md` are green.

## Schema / database (UNION, additive only)

| Decision | Keep |
|----------|------|
| `backend/prisma/schema.prisma` | Union of both sides. Dest locations/returns/print jobs + main `KOTPrintEvent` and Sale/KOT cancel fields. |
| `Purchase` vs `Sale` reorder conflict | Dest `Purchase` model (false reorder). |
| `UtilityBill` | Dest richer model (`receiptNumber`, `rawText`, `metadata`, optional kiosk fields). Dropped main’s duplicate thinner model. |
| `ensure-additive-columns.cjs` | Union: dest remote-print tables + Product discount + main Sale/KOT cancel + `KOTPrintEvent` + richer UtilityBill. |
| `ensureAdditiveSchema.ts` | Dest personalInfo backfill + cancel columns + `KOTPrintEvent` CREATE. |

No columns/tables dropped. No `prisma migrate reset`.

## Tenant / auth / API

| File | Decision |
|------|----------|
| `ownerUser.ts` / `getOwnerUserId` | Canonical agent → admin `ownerId`. |
| `authMiddleware.ts` | Dest JWT/dev-user/ban/businessType **plus** main `resolveActor` → `ownerId` + permissions. |
| `authController.ts` | Dest (QR login, access codes, phone OTP). Main only added tenant helper and stripped those. |
| `app.ts` | All dest routes mounted (locations, notifications, utility-bills, printer-logs, returns/exchanges, device-tokens, print-jobs, public receipt). |
| Tenant-scoped controllers | Dest (`ours`) for category/customer/expense/feedback/location/product/purchase/settings/supplier + sales/reports. |
| `kotOrderController.ts` | Dest include/actor snapshot **plus** main `assignTable` / `cancelOrder` via `getOwnerUserId`. |
| `utilityBillController.ts` | Dest PDF extract. Routes use main `requirePermission('canAccessSales')`. |

## Frontend (`frontend/`)

**Source of truth for live POS / KOT / daybook / thermal print / VEER+DEV fleet:** production `main`.

Ported from dest into that base:

- Public invoice routes `/receipt/:id` and `/bill/:id` (`PublicInvoicePage`)
- Dest auth (QR login, access codes, onboarding payload, redeem code)
- Sale return/exchange types and UI, GST billing panels, receipt-builder extras
- Dest i18n keys merged into English (196 missing keys)
- Shared types (`PrinterConfig.autoPrintOnSale` / `paperWidth`, ESC/POS `threeCol` / `feedAndCut`, `fetchApi<T>`) so dest screens typecheck against main print pipeline

`TaxReportPage` stays deleted (main redirects GST to daybook).

Web printers remain **VEER + DEV** only (`printerFleet.ts`). Mobile keeps the full SEZNIK fleet.

## Mobile

`mobile-inventory/` kept from dest. Same API/tenant as web.

## Junk removed from git

Untracked vendor blobs under `backend/src` (Android SDK zips/jars/apks, Demo_small, SEZNIK Veer exe, mojibake printer SDK folders). Ignored via `.gitignore`. Runtime LPAPI lives in `mobile-inventory/`.

## Follow-ups (not merge blockers)

- Web remote-print sender UI vs mobile print jobs
- POS calculator on web (flag)
- Feature parity list in the handoff (purchases/day close on mobile, etc.)
- Staging soak 24–48h before `dev` → `main`
