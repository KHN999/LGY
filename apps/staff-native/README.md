# LGY Staff (native) — Android offline app

Native Android staff app (Expo / React Native). Goal: sell + receive **offline**,
print to the printer, and **sync** to the existing API when there's signal. The
web app stays for admin. Standalone project — its own `npm install`, not pnpm.

**Architecture (thin client):** the existing NestJS API stays the source of truth
and keeps all business logic. The app caches reference data (catalog, customers,
stock) locally, queues sales/payments offline, and syncs them up. It authenticates
with a **Bearer token** (login returns the token; stored in expo-secure-store).

## Run M1 (login + home + catalog sync)

M1 uses only Expo-Go-compatible modules, so **no APK build needed yet** — test it
by scanning a QR with the **Expo Go** app on Android:

```bash
cd apps/staff-native
npm install
npx expo install --fix      # aligns versions to the Expo SDK
npx expo start              # scan the QR with Expo Go (Android)
```

Then:
- Log in with a staff/admin account (e.g. the seeded `kaung` / its password).
- Tap **Sync catalog** — it pulls `/item-types` over the Bearer-auth API and caches
  them. Turn off internet and tap it again → it reports the locally-cached count.
- The big tiles (Sell / Receive / Debts / Stock) are placeholders for now.

If login works and the catalog caches, the foundation is proven (build, auth,
API, local cache) and we build the real screens next.

> Later milestones (printing, the SQLite outbox + sync) add native modules that
> need a dev/EAS build instead of Expo Go:
> `npm i -g eas-cli && eas login && eas build -p android --profile preview`.

## Roadmap

- **M1** login + home + catalog cache ✅ (this)
- **M2** Sell screen: cart from cached catalog/customers → local SQLite outbox → print → sync
- **M3** Receive money + customer ledger (same offline pattern)
- **M4** printing (A5 to the HP over WiFi), daily close, etc.
