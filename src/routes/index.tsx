import { createFileRoute } from "@tanstack/react-router";
import { FinanceProvider } from "@/lib/finance-context";
import { LifeVaultApp } from "@/components/lifevault/LifeVaultApp";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeVault — Personal Finance, Beautifully" },
      {
        name: "description",
        content:
          "A premium personal finance dashboard for tracking net worth, cash flow, insurance, and life goals — built for India.",
      },
      { property: "og:title", content: "LifeVault — Personal Finance" },
      {
        property: "og:description",
        content:
          "Track net worth, budgets, and inflation-adjusted life goals in one beautiful dashboard.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <FinanceProvider>
      <LifeVaultApp />
      <Toaster richColors theme="dark" position="top-right" />
    </FinanceProvider>
  );
}
