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
          "How LifeVault handles your data: client-side AES-256-GCM encryption, encrypted cloud storage, zero plaintext access.",
      },
      { property: "og:title", content: "Privacy Policy — LifeVault" },
      {
        property: "og:description",
        content:
          "Your financial data is encrypted on your device and stored as ciphertext in our cloud vault. We have zero access to your plaintext.",
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
              <strong className="text-foreground">Account email (and Google name if you sign in with Google)</strong> —
              used only to sign you in and personalize the app.
            </li>
            <li>
              <strong className="text-foreground">Financial data you enter</strong> —
              accounts, balances, goals, vault entries. This data is encrypted
              on your device with your PIN before it ever leaves it. The cloud
              only ever sees ciphertext.
            </li>
          </ul>
        </Section>

        <Section title="2. How data is stored">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              All data is encrypted with <strong className="text-foreground">AES-256-GCM</strong>{" "}
              using a key derived from your PIN, on your device, before upload.
            </li>
            <li>
              The encrypted blob is stored in our secure cloud vault, scoped
              to your account so only you can read or write it.
            </li>
            <li>
              <strong className="text-foreground">We have zero access to your plaintext.</strong>{" "}
              Without your PIN, no one — including us — can read it.
            </li>
          </ul>
        </Section>

        <Section title="3. What Google permissions we use">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              If you choose Google sign-in, LifeVault only reads your
              <strong className="text-foreground"> basic profile (name and email)</strong>{" "}
              to identify your account.
            </li>
            <li>
              We <strong className="text-foreground">do not access</strong> Gmail,
              Drive, Calendar, or any other Google service.
            </li>
          </ul>
        </Section>

        <Section title="4. Data deletion">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Go to <strong className="text-foreground">Settings → Data</strong>{" "}
              to export your data or wipe everything stored for your account.
            </li>
            <li>
              Signing out from <strong className="text-foreground">Settings → Account</strong>{" "}
              clears the local cache on that device; the encrypted cloud copy
              remains until you delete it from Settings → Data.
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
