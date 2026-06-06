# LifeVault Phase 1 + 2 Build Plan

This is a large scope (8 features + font swap). I'll deliver in 3 batches so you can review progress and we don't risk breaking working flows.

## Batch 0 — Fonts (apply first, ship immediately)
- Add Playfair Display + Plus Jakarta Sans `<link>` in `index.html` (or TanStack `__root.tsx` head).
- Update `src/styles.css`: replace `--font-display` → Playfair Display, `--font-body` → Plus Jakarta Sans. Keep existing semantic tokens.
- Add a `.tabular` utility class (`font-variant-numeric: tabular-nums`) and apply to money components (`formatINR` consumers — wrap in `<span className="tabular">`).
- Search/remove "DM Serif Display" / "DM Sans" references.

## Batch 1 — Phase 1
### Feature 1: Home tab + dashboard
- New nav entry `home` (LayoutDashboard icon) as first tab in `LifeVaultApp.tsx`; default tab becomes `home`.
- New `HomeView.tsx` with sections: greeting header, net worth hero (with sparkline using Recharts, snapshot button reusing existing snapshot fn), 4 quick stat cards (income/expense/savings rate/runway computed from finance-context), upcoming bills (next 3), top 3 goals, rebalancing alert (>5% deviation from target allocation), quick actions (deep-link to existing add flows), getting started checklist (stored as `vault.onboardingChecklistDismissed` flag — auto-derived from data presence + dismiss when all 6 complete).

### Feature 2: Recurring Bills
- Extend vault state with `bills: Bill[]` array (id, name, category, amount, currency, frequency, nextDueDate, accountId, autoPost, notes, paidHistory[]).
- Add "Bills" sub-tab inside CashFlowView between existing tabs.
- `BillsView.tsx`: summary row, grouped list (Overdue/This Week/Upcoming/Paid this month), add/edit modal, Mark Paid (creates transaction + advances `nextDueDate` by frequency), calendar toggle (simple month grid).

### Feature 3: Document Expiry Alerts
- New util `vault-expiry.ts` that scans all vault categories for known expiry fields and returns `{record, field, date, daysLeft, severity}`.
- Add "Needs Attention" card at top of `VaultView`. Per-item dismiss persisted in `localStorage` for 7 days.
- Add small "X items expiring soon" card on Home dashboard linking to Vault.

### Feature 4: Feedback button
- Existing `feedback` table + `submitFeedback` server fn already exist (verified in codebase context). Will reuse and adapt schema if needed.
- New floating `FeedbackButton.tsx` bottom-left (above mobile bottom nav with `bottom-20 md:bottom-4`). Opens dialog with toggle Bug/Feature/General, title, description (500 char counter), 1–5 star rating (general only), prefilled email, submit → toast.

## Batch 2 — Phase 2
### Feature 5: Spending Analytics
- Rework Insights tab inside CashFlowView: period selector (This Month / Last Month / 3M / 6M / 12M / YTD), summary ribbon w/ monthly averages, savings rate trend line chart (Recharts) with 20/40% reference lines, category donut + ranked list w/ MoM delta, MoM grouped bar (top 5 cats), unusual-spend amber cards (>30% above 3M avg, dismissable), top 5 transactions.

### Feature 6: Loan Payoff Planner
- Reuse `loan-utils.ts`. Add expandable `PayoffPlannerPanel` to each liability card in NetWorthView.
- Sections: summary, extra-payment calc (live recompute via `n = -log(1 - rP/EMI)/log(1+r)`), amortization table (first 6 / show all), prepay-vs-invest comparison @ 12% CAGR with advisory line.

### Feature 7: Password Health
- In Vault Passwords category page: top card with circular gauge (Recharts RadialBar) + score formula (start 100, −10 weak, −15 dup, −5 if >90d old).
- Strength scoring util. Issue lists for weak / duplicate / old. Per-record strength bar. Copy button with `setTimeout(() => navigator.clipboard.writeText(''), 30000)` + countdown toast.

### Feature 8: What's New page
- New route `src/routes/whats-new.tsx`. Hardcoded changelog (replaces / supplements existing `CHANGELOG` constant). Settings link + 7-day "NEW" badge on nav driven by `localStorage` timestamp vs `APP_VERSION`.

## Technical notes
- All new money rendered with `tabular-nums` utility.
- All new state lives in existing vault `finance-context` save loop — no separate persistence layer except feedback (Supabase) and per-user dismiss flags (localStorage).
- Recharts is the only chart lib; Lucide for icons.
- New route added to routeTree by router plugin automatically.
- No existing files removed; only additive + targeted edits to `LifeVaultApp`, `CashFlowView`, `NetWorthView`, `VaultView`, `SettingsView`, `styles.css`, `__root.tsx`.

## Out of scope / assumptions
- Feedback table already exists (Supabase). I'll reuse; if column names differ I'll align the insert.
- Calendar view for bills will be a lightweight in-house grid (not a heavy date library), to avoid new deps.
- "Currency" field on bills defaults to base currency; multi-currency conversion uses existing FX context.
- Confirm: ship in 3 batches (fonts → P1 → P2) with one approval at the end of each, OR ship everything in one large batch?
