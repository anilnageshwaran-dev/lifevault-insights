export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  highlights: string[];
}

// Only major user-visible changes — keep this list curated.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2026-06-04",
    title: "Profile drawer & quick access",
    highlights: [
      "New left profile pane with greeting, quick stats and today's agenda",
      "Currency switcher, sync status and security shortcuts in the drawer",
      "Profile picture in the header opens the drawer",
      "Sign out moved into the drawer; lock has a single entry point",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-06-03",
    title: "Net worth controls",
    highlights: [
      "Hide values toggle to blur sensitive amounts",
      "Display-currency switch for assets, liabilities and net worth",
      "By-currency breakdown card for multi-currency users",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-06-02",
    title: "Quick add & navigation polish",
    highlights: [
      "Floating + button to quickly add income, expense, transfer or bill",
      "Scrollable tab strip on Cash Flow for mobile",
      "Inflation calculator promoted to Goals header",
      "Parents details in Essentials; Age/Dependents now shared across regions",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-01",
    title: "Reset, biometrics & investments",
    highlights: [
      "Reset all data from Settings with confirmation, syncs across devices",
      "Biometric unlock (WebAuthn) alongside PIN",
      "Investment prices: manual entry and AI-powered refresh",
      "Loan utilities for EMI and amortisation",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-05-20",
    title: "LifeVault launch",
    highlights: [
      "Essentials, Net Worth, Cash Flow, Goals and Vault tabs",
      "Encrypted backup with PIN, Google sign-in and Drive sync",
      "Household sharing via secure invite tokens",
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
