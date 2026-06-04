# Fix 1–5 + Start Phase 3

## Part A — Loose ends (this pass)

**1. Auto-link Drive when signed in with Google**
- `SettingsView` / Data tab: if `auth.user.app_metadata.provider === 'google'` AND a Google `provider_token` is available on the session, auto-call `drive.connect()` on mount and hide the "Connect Drive" button.
- Show a single row: "Synced to Google Drive as {email}" with only a "Disconnect" action.
- Fallback (non-Google sign-in or missing scope): keep current "Connect Drive" button.

**2. Vault dedup**
- Remove `bank`, `cards`, `investments`, `loans` categories from `VaultView` category list (keep `insurance`, `documents`, `passwords`, `notes`, `other`).
- Silent migration: any existing records in removed categories get moved into `documents` with a note prefix so nothing is lost.

**3. Bills vs Recurring dedup**
- Hide standalone "Recurring" UI in `CashFlowView`. Auto-migrate `state.recurring[]` into `state.bills[]` on hydrate (mapped frequency, nextDue, account).
- Keep `recurring` field in state for back-compat but stop rendering/editing it.

**4. FX freshness indicator**
- In `EssentialsView` near the Health Score and in `NetWorthView` header, show "Rates as of {fx.fetchedAt}" with a small refresh icon → `refreshFx(true)`.

**5. Region delete safety**
- Before removing a region in `EssentialsView`, count linked goals (`Emergency Fund · {region.name}`) and linked insurance entries; show confirm dialog: "This region has X linked items. Delete anyway?" with Cancel / Delete options.

## Part B — Phase 3 kickoff

Phase 3 is large. Starting with the two highest-impact items now; the rest follow in subsequent passes.

**P3.1 — Household shared data (read-only first)**
- New Supabase table `household_shared_snapshots(household_id, user_id, encrypted_blob, updated_at)` with RLS so household members can SELECT each other's rows.
- On every local save, also push an encrypted snapshot (same PIN-derived key shared via household join code) for the user.
- New `HouseholdTab` section "Shared View": pick a member → see their net worth, cash flow summary, goals (read-only, aggregated in base currency).
- Out of scope this pass: write-through editing of another member's data.

**P3.2 — PDF export of Financial Snapshot**
- New "Export Report" button in Settings → generates a multi-page PDF (using `jspdf` + `jspdf-autotable`) containing: profile summary, net worth breakdown, cash flow last 90 days, goals progress, insurance coverage, region cards.
- Saved client-side (no server round-trip).

**Deferred to later Phase 3 passes** (acknowledged, not in this build):
- Bill due-date push notifications (needs service worker push + VAPID keys)
- Investment price auto-refresh (needs market-data provider key)

## Technical Notes

- Drive auto-connect uses existing `drive-context.tsx` — only the trigger changes.
- Vault migration runs inside `ensureRegions`-style hydrate path in `finance-context`.
- `Bill` already supports all `RecurringTemplate` shapes; migration is a straightforward `map`.
- Shared snapshots reuse existing `encryptWithKey` — household share key derived from a household-level passphrase set by owner at creation time (prompted on first share).
- PDF generated entirely in the browser; no server function needed.

## Files Touched (estimate)

- `src/components/lifevault/SettingsView.tsx`
- `src/components/lifevault/VaultView.tsx`
- `src/components/lifevault/CashFlowView.tsx`
- `src/components/lifevault/EssentialsView.tsx`
- `src/components/lifevault/NetWorthView.tsx`
- `src/components/lifevault/HouseholdTab.tsx`
- `src/lib/finance-context.tsx`
- `src/lib/drive-context.tsx` (auto-connect helper)
- New: `src/lib/pdf-report.ts`
- New migration: `household_shared_snapshots` table + RLS
- `bun add jspdf jspdf-autotable`
