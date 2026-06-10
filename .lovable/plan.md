
# Investments + SIP overhaul

Scope is large (data model, forms, edit flow, SIP engine, bills page). I'll keep all UI inline within existing files — no new pages or routes.

## 1. Data model (`src/lib/finance-context.tsx`)

- Add `"investment"` to `AssetCategory` (keep `equity` + `debt` literals defined for backward-compat type narrowing).
- Extend `AssetItem` with:
  - `purchases?: { id; date; amount; units?; price?; notes? }[]` (purchase history)
  - `principal?`, `interestRate?`, `startDate?`, `tenureMonths?`, `maturityDate?`, `maturityAmount?` (FD/RD/Bond)
  - `currentBalance?`, `annualContribution?`, `expectedRate?` (PPF/EPF/NPS)
  - `currentPrice?` (stocks/MF — `avgPrice`/`units` already exist)
  - SIP fields: `sipEnabled?`, `sipAmount?`, `sipFrequency?` (`"monthly"`), `sipDate?` (1–28), `sipStartDate?`, `sipStatus?` (`"active"|"paused"`), `lastSipProcessedDate?`, `sipHistory?: { date; amount }[]`
- Add `SUBTYPE_GROUPS` constant (Stocks & Equity / Fixed Income / Hybrid & Other) for grouped dropdown.
- Migration in `ensureRegions` (runs on every load): map `category === "equity" || "debt"` → `"investment"`, preserve `subtype` (default by old category if missing).
- `calculateAssetBreakdown`: route `"investment"` items to the existing chart bucket(s) — keep `equity`/`debt` keys for chart shape; classify each investment by subtype group (stocks-equity → equity bucket; fixed-income → debt bucket; hybrid → split equity).
- Add `INVESTMENT_SUBTYPES` array and `subtypeGroup(subtype)` helper.

## 2. Net Worth view (`NetWorthView.tsx`)

- Merge Equity + Debt cards into a single "💼 Investments" category card listing all `category === "investment"` assets grouped by subtype group.
- Tap row → opens new `InvestmentEditModal` (see §3).
- "Add Investment" button opens same modal in create mode with subtype picker.
- Remove standalone FD handling here; FDs continue to live on the Cash Flow Accounts list AND also surface as an Investment row if a flag tells us (simpler: drop the duplicate — FD as account-type stays, FD as Investment subtype is a separate manual entry). I'll **keep accounts-FD as-is** and add Investment-FD as the new modeled record so the user's per-subtype request works without breaking existing account FDs.

## 3. New `InvestmentEditModal` (inside `NetWorthView.tsx`)

Subtype-driven form sections:
- Stocks/ETF/Equity-MF/Index/Mutual Funds: units, avg/NAV, current price/NAV → auto P&L
- FD/RD/Bonds/Corporate FD/RBI Bond/NSC/KVP/Sukanya/SCSS/Post Office TD: principal, rate %, start date, tenure months → maturity date, maturity amount (compound monthly), current value (linear-time accrual), interest earned
- PPF/EPF/NPS: current balance, annual contribution, expected rate (defaults 7.1 / 8.15 / 10) → projected value at retirement-ish horizon (use tenure field, default 15y)
- Everything else: name, current value, total invested, currency
- Footer: **Save**, **Add More** (purchase add → recompute weighted avg for stocks/MF; deposit add for FD/PPF), **Delete** (with confirm)
- Collapsible **History** section listing `purchases[]`
- For MF/IndexFund/ETF subtypes: SIP toggle block (amount, frequency, day 1–28, start date, status)
- "Expected returns" section: subtype-driven (FD shows maturity; PPF/EPF/NPS shows projection; stocks/MF shows 3 scenarios 10/14/18% over 10y)
- All ₹ via existing `formatMoney` (Indian format already wired in `currency.ts`)

## 4. SIP auto-processing

- New helper `computeDueSips(state, today)` in `src/lib/sip-engine.ts`: returns due SIPs (active, today ≥ next due date computed from `sipDate` + `lastSipProcessedDate` || `sipStartDate`).
- On app open after PIN unlock (in `AppRoot.tsx` or `LifeVaultApp.tsx`, whichever owns post-unlock effects), call helper; if any due, show `SipDueSheet` bottom sheet.
- Sheet: list + "✅ Mark All as Invested" / "Review Each" (modal stepper with editable NAV/units).
- Processing creates one `Transaction { type: "investment", category: "Mutual Fund SIP", description: "<fund> SIP", amount, date: today, accountId: optional }`, appends to `sipHistory[]`, updates `lastSipProcessedDate`, increments `invested` on the asset.
- Existing `accountBalance` already subtracts investments from accounts ⇒ Net Worth invariant holds.
- Toast on completion.

## 5. Bills page (`CashFlowView.tsx` → `BillsTab`)

- Below the existing rose-themed bills list, render a new emerald-themed "📈 Investments Due This Month" panel listing each active SIP due in current month: `[Fund] | ₹amt | Due Xth` + "Mark as Invested" button (per-SIP, reuses the same processor as §4).
- Extend summary panel with two-row breakdown:
  - Bills (expenses) — rose
  - SIPs (investments) — emerald
  - Total cash needed
- SIP amounts already excluded from expense totals because tx.type is `"investment"` (verify in `Insights`/`Budget` computations — they already filter by type).

## 6. Bottom sheet component

- New `src/components/lifevault/SipDueSheet.tsx` using existing shadcn `Sheet`/`Dialog` primitives.

## 7. Constraints

- No new routes. Only files touched: `finance-context.tsx`, `NetWorthView.tsx`, `CashFlowView.tsx`, `AppRoot.tsx` (one hook), plus 2 new files: `sip-engine.ts`, `SipDueSheet.tsx`.
- All persistence flows through existing vault save mechanism (`setState` → encrypted sync).
- Indian ₹ formatting via existing `formatMoney("INR")`.
- Toast via `sonner` on every save/delete/process.
- Confirm dialog before delete (shadcn `AlertDialog`).
- Migration runs on hydrate — no data loss for existing equity/debt assets.

## Technical notes

- "Current value" for FD = `principal × (1 + (rate/12)/100)^elapsedMonths` clamped at maturity amount.
- Weighted avg recompute on Add More: `newAvg = (oldUnits×oldAvg + newUnits×newPrice) / (oldUnits+newUnits)`.
- SIP next-due: if `lastSipProcessedDate` set, next = same day-of-month next month (clamped to month length); else use `sipStartDate`.
- One in-progress task tracker entry per change block; I'll keep them small.

Proceed?
