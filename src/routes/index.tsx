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
          "Premium personal finance dashboard with zero-knowledge encryption, PIN lock, and a secure vault for credentials, accounts, and household finances.",
      },
      { property: "og:title", content: "LifeVault — Personal Finance, Beautifully" },
      {
        property: "og:description",
        content:
          "Track net worth, budgets, and inflation-adjusted goals. PIN-locked, encrypted, yours.",
      },
      { property: "og:url", content: "https://lifevaultapp.lovable.app/" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "canonical", href: "https://lifevaultapp.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LifeVault",
          url: "https://lifevaultapp.lovable.app/",
          description:
            "Private, PIN-locked personal finance dashboard for net worth, cash flow, goals, and household accounts with end-to-end encryption.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LifeVault",
          url: "https://lifevaultapp.lovable.app/",
          description:
            "LifeVault builds private, encrypted personal finance tools for individuals and households.",
        }),
      },
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
