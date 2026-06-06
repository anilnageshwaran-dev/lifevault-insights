import { createFileRoute } from "@tanstack/react-router";
import { AppRoot } from "@/components/lifevault/AppRoot";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeVault — Personal Finance & Secure Vault for Indians" },
      {
        name: "description",
        content:
          "Free personal finance app for Indians. Track net worth, manage cash flow, plan goals, and store bank details, passwords, and documents — all encrypted with zero-knowledge security.",
      },
      {
        name: "keywords",
        content:
          "personal finance india, net worth tracker, financial vault, encrypted finance app, free finance app india, zerodha import, mutual fund tracker, LifeVault",
      },
      { name: "theme-color", content: "#FFFFFF" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "LifeVault" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "LifeVault — Personal Finance & Secure Vault for Indians" },
      {
        property: "og:description",
        content:
          "Free personal finance app for Indians. Track net worth, manage cash flow, plan goals, and store credentials — all encrypted with zero-knowledge security.",
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
          "@type": "WebApplication",
          name: "LifeVault",
          description:
            "Free personal finance and secure vault app for Indians",
          url: "https://lifevaultapp.lovable.app/",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web, Android, iOS",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
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
