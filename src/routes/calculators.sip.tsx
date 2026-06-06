import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SipCalculator } from "@/components/lifevault/SipCalculator";

export const Route = createFileRoute("/calculators/sip")({
  head: () => ({
    meta: [
      { title: "SIP Calculator — LifeVault" },
      { name: "description", content: "Calculate SIP future value, required monthly investment for goals, and compare return rates." },
      { property: "og:title", content: "SIP Calculator — LifeVault" },
      { property: "og:description", content: "Plan your investments with compound growth." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to LifeVault
        </Link>
      </header>
      <main className="px-4 py-8">
        <SipCalculator />
      </main>
    </div>
  );
}
