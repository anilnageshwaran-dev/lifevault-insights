import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const CONTACT_EMAIL = "anilnageshwaran@gmail.com";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — LifeVault" },
      {
        name: "description",
        content:
          "How LifeVault handles your data: client-side AES-256-GCM encryption, storage in your own Google Drive, zero server access.",
      },
      { property: "og:title", content: "Privacy Policy — LifeVault" },
      {
        property: "og:description",
        content:
          "Your financial data is encrypted on your device and stored in your own Google Drive. We have zero access.",
      },
      { property: "og:url", content: "https://lifevaultapp.lovable.app/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://lifevaultapp.lovable.app/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
        {title}
      </h2>
      <div className="text-base text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to LifeVault
        </Link>

        <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: June 5, 2026
        </p>

        <Section title="1. What data we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-foreground">Google account name and email</strong> —
              used only to sign you in and personalize the app.
            </li>
            <li>
              <strong className="text-foreground">Financial data you enter</strong> —
              accounts, balances, goals, vault entries. This data is encrypted
              on your device and stored in your own Google Drive. It never
              touches our servers.
            </li>
          </ul>
        </Section>

        <Section title="2. How data is stored">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              All data is encrypted with <strong className="text-foreground">AES-256-GCM</strong>{" "}
              using a key derived from your PIN.
            </li>
            <li>
              The encrypted blob is stored in a{" "}
              <strong className="text-foreground">LifeVault</strong> file in your
              personal Google Drive.
            </li>
            <li>
              <strong className="text-foreground">We have zero access to your data.</strong>{" "}
              Without your PIN, no one — including us — can read it.
            </li>
          </ul>
        </Section>

        <Section title="3. What Google permissions we use">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-sm">
                drive.file
              </code>{" "}
              — lets LifeVault read and write only the data file it creates in
              your Google Drive.
            </li>
            <li>
              We <strong className="text-foreground">cannot access any other files</strong>{" "}
              in your Drive. Google enforces this at the OAuth scope level.
            </li>
          </ul>
        </Section>

        <Section title="4. Data deletion">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Go to <strong className="text-foreground">Settings → Data</strong>{" "}
              to delete your account and remove all app data.
            </li>
            <li>
              You can also manually delete the{" "}
              <strong className="text-foreground">LifeVault</strong> file from
              your Google Drive at any time.
            </li>
            <li>
              Disconnecting Google Drive from{" "}
              <strong className="text-foreground">Settings → Account</strong>{" "}
              revokes our access immediately.
            </li>
          </ul>
        </Section>

        <Section title="5. Contact">
          <p>
            Questions or concerns about your privacy? Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                "LifeVault privacy question",
              )}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <p className="text-xs text-muted-foreground border-t border-border pt-6 mt-12">
          LifeVault is a zero-knowledge personal finance app. Your data stays
          yours.
        </p>
      </div>
    </div>
  );
}
