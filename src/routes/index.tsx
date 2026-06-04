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
      { name: "theme-color", content: "#0A0F1E" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "LifeVault" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
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
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/5f170c05-aeb0-4cb3-a63e-a4f7293b12a9/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/__l5e/assets-v1/35dfce03-92de-4e01-84ec-85450234c4ca/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/__l5e/assets-v1/df51c657-7131-4d53-8602-b7e473c4b872/icon-512.png" },
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
