# Family Sharing — Households

Turn LifeVault from a solo app into a shared family workspace, while keeping the Vault (passwords/docs) strictly private per member.

## What you'll see when it's done

- New "Household" section in Settings with: create household, invite by email, pending invites, members list, leave/remove.
- A household switcher in the top bar when you belong to one — "Personal" vs "Smith Family".
- Bank accounts, transactions, budgets, recurring, goals, assets (incl. shares/MFs), liabilities, emergency fund, and insurances become *household-scoped* when a household is selected; everyone in the household sees and edits the same data live.
- Vault stays private to each member, always. Marked "🔒 Personal — never shared" in the UI.
- Each member keeps their own PIN locally; sign-in is by email/password or Google.

## Architecture

```text
Auth (Supabase)        ← email/password + Google sign-in
   │
   ▼
profiles               ← display_name, base_currency, avatar
   │
   ▼
households             ← owner_id, name, created_at
   │
household_members      ← household_id, user_id, joined_at
household_invites      ← household_id, email, token, expires_at, status
   │
   ▼ (household_id FK on every shared row, RLS gated by membership)
accounts, transactions, budgets, recurring,
goals, assets, liabilities, settings_shared
```

Vault records and the local PIN-derived key stay on-device — they never touch the database.

## Phased build

### Phase 1 — Cloud + accounts (this turn)
1. Enable Lovable Cloud.
2. Add Supabase auth: email/password + Google (via Lovable broker).
3. Create `profiles` table + trigger; `_authenticated` layout via the managed integration.
4. New screens: `/auth` (sign-in/up), basic `/account` page.
5. Update the launch gate: Onboarding → Sign in → PIN setup/unlock → app. PIN remains the local quick-unlock; encrypted local cache continues to work for offline use.

### Phase 2 — Households + invites
1. Tables: `households`, `household_members`, `household_invites` with RLS via a `has_household_access(user, household)` security-definer function (no recursive policies).
2. Server fns: `createHousehold`, `inviteMember`, `acceptInvite(token)`, `removeMember`, `leaveHousehold`, `listMembers`.
3. Invite email via Lovable Email with a magic link → `/invite/$token`.
4. Settings → "Household" card with full UX (create, invite, pending list, members, copy link).

### Phase 3 — Shared data migration
1. New tables for shared resources, each with `household_id`, `created_by`, RLS = "member of household_id".
2. Server fns mirror the current finance actions (CRUD on each entity).
3. `FinanceProvider` becomes household-aware:
   - When no household selected → current local + Drive flow (unchanged).
   - When a household is selected → reads/writes go through server fns; local cache holds a read-only mirror for offline.
4. One-time migration UI: "Move my current data into 'Smith Family'?" — uploads existing local state into the household tables.

### Phase 4 — Realtime + polish
1. Supabase realtime subscriptions on shared tables → instant cross-device updates.
2. "Created by Priya · 2m ago" attribution on transactions.
3. Conflict-free: last-write-wins per row, server timestamps.

## Key technical decisions

- **Auth model**: Supabase is the source of truth for identity. PIN becomes a *device unlock* only (still gates local cache decryption and Vault). User flow: sign in → set/enter PIN → app.
- **Vault stays local-only**: never persisted to Supabase. Each device keeps its own Vault, encrypted by the local PIN. Drive sync (already built) handles per-user Vault backup.
- **Permissions = Owner + Members**: owner can invite/remove and delete the household; everyone else has full read/write on shared data. Simple, matches your choice.
- **Currency**: each member keeps their display currency in `profiles`; household data is stored in source currency per row and converted client-side using the existing FX cache.
- **RLS**: every shared table uses `has_household_access(auth.uid(), household_id)` to avoid recursion. Service-role bypass only inside server fns that need it (invite token lookup, etc.).
- **Drive sync**: continues to back up *your personal slice* (your Vault + a local snapshot). Shared household data lives in Cloud and isn't duplicated to Drive.

## Scope confirmation

Phase 1 alone is a substantial change (auth gate, new screens, new launch flow). Phases 2–4 are each comparable in size. **I recommend shipping Phase 1 first, verifying you can sign in, then doing Phase 2 next turn.** Reply "ship phase 1" to start, or "do it all in one pass" if you'd rather wait longer for a single big delivery.
