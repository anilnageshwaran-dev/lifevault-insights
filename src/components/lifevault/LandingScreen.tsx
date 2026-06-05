import * as React from "react";
import { Loader2, Shield, Cloud, LineChart } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { lovable } from "@/integrations/lovable/index";
import { LifeVaultIcon } from "./LifeVaultIcon";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-1.7 13.3-4.7l-6.2-5c-1.9 1.3-4.3 2.2-7.1 2.2-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5c-.4.4 6.7-4.9 6.7-14.6 0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function LandingScreen({ onUseEmail }: { onUseEmail: () => void }) {
  const [gBusy, setGBusy] = React.useState(false);

  const google = async () => {
    setGBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setGBusy(false);
      }
    } catch (e) {
      toast.error((e as Error).message || "Google sign-in failed");
      setGBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <LifeVaultIcon className="h-12 w-12" />
            <span className="font-display text-2xl sm:text-3xl">LifeVault</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-tight mb-5">
            Your Personal Financial Vault
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Securely track your net worth, manage cash flow, set financial goals,
            and store sensitive credentials — all encrypted and stored in your
            own Google Drive.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={google}
              disabled={gBusy}
              className="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-60"
            >
              {gBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              Sign in with Google
            </button>
            <button
              onClick={onUseEmail}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Use email instead
            </button>
          </div>
        </div>
      </section>

      {/* What is LifeVault */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl mb-5">
            What is LifeVault?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            LifeVault is a zero-knowledge personal finance app. All your
            financial data is encrypted with your personal PIN and stored
            exclusively in your own Google Drive. We never store or transmit
            your data in plaintext — not even we can read it.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Zero-Knowledge Encryption",
              body:
                "Your data is encrypted with AES-256 before it leaves your device. Only your PIN can unlock it.",
            },
            {
              icon: Cloud,
              title: "Your Data in Your Drive",
              body:
                "LifeVault stores one encrypted file in your Google Drive. You own it completely — download or delete it anytime.",
            },
            {
              icon: LineChart,
              title: "Complete Financial Picture",
              body:
                "Track net worth, income, expenses, goals, and store bank details, passwords, and documents securely.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Google permissions */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl mb-5">
            What Google permissions does LifeVault use?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            LifeVault requests access to Google Drive (drive.file scope)
            exclusively to save and load your encrypted vault file. We can only
            access files that LifeVault itself creates — we cannot see any other
            files in your Drive.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-5">
            <Link
              to="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <a
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
          <div>LifeVault — Your data, your drive, your control.</div>
        </div>
      </footer>
    </div>
  );
}
