import { createFileRoute } from "@tanstack/react-router";
import { AppRoot } from "@/components/lifevault/AppRoot";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeVault — Personal Finance, Beautifully" },
      {
        name: "description",
        content:
          "Premium personal finance dashboard with zero-knowledge encryption, PIN lock, and secure vault for credentials.",
      },
      { property: "og:title", content: "LifeVault — Personal Finance" },
      {
        property: "og:description",
        content:
          "Track net worth, budgets, and inflation-adjusted goals. PIN-locked, encrypted, yours.",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <AppRoot />
      <Toaster richColors theme="system" position="top-right" />
    </>
  );
}
