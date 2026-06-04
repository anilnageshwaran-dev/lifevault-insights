import * as React from "react";
import { X } from "lucide-react";
import { LifeVaultIcon } from "./LifeVaultIcon";

const KEY = "lifevault_install_dismissed";

export function InstallBanner() {
  const [prompt, setPrompt] = React.useState<{ prompt: () => Promise<void> } | null>(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as unknown as { prompt: () => Promise<void> });
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  if (!show || !prompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:right-6 md:w-96 z-30 rounded-2xl border border-border bg-card shadow-2xl p-4 flex items-start gap-3 animate-[fadeUp_300ms_ease-out]">
      <LifeVaultIcon className="h-10 w-10" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Install LifeVault</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Add LifeVault to your home screen for quick access.
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => { await prompt.prompt(); dismiss(); }}
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
      </div>
      <button onClick={dismiss} className="p-1 rounded hover:bg-accent text-muted-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
