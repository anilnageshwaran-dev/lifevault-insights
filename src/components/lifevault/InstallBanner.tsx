import * as React from "react";
import { X, Share, Plus } from "lucide-react";
import { LifeVaultIcon } from "./LifeVaultIcon";

const KEY = "lifevault_install_dismissed";
const SHOW_AFTER_MS = 1500;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; other browsers use display-mode.
  const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    navStandalone === true
  );
}

function detectIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  // iPadOS reports as Mac with touch
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOS || iPadOS;
}

export function InstallBanner() {
  const [prompt, setPrompt] = React.useState<BIPEvent | null>(null);
  const [show, setShow] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // already installed
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {}

    const ios = detectIOS();
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS never fires beforeinstallprompt — show iOS instructions after a delay.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (ios) {
      t = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    }

    const onInstalled = () => {
      setShow(false);
      try { localStorage.setItem(KEY, "1"); } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {}
    dismiss();
  };

  if (!show) return null;
  if (!prompt && !isIOS) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:right-6 md:w-96 z-30 rounded-2xl border border-border bg-card shadow-2xl p-4 flex items-start gap-3 animate-[fadeUp_300ms_ease-out]">
      <LifeVaultIcon className="h-10 w-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Install LifeVault</div>
        {prompt ? (
          <>
            <div className="text-xs text-muted-foreground mt-0.5">
              Add LifeVault to your home screen for quick, app-like access.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> in Safari, then{" "}
              <span className="whitespace-nowrap">
                <Plus className="inline h-3.5 w-3.5 align-text-bottom" /> Add to Home Screen
              </span>
              .
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent"
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
      <button onClick={dismiss} className="p-1 rounded hover:bg-accent text-muted-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
