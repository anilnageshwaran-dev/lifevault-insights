import * as React from "react";
import { Lock } from "lucide-react";
import { PinKeypad } from "./PinKeypad";
import { useLock } from "@/lib/lock-context";

export function PinLockScreen() {
  const { unlock, lockoutUntil } = useLock();
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState(0);

  React.useEffect(() => {
    if (!lockoutUntil) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const r = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lockoutUntil]);

  React.useEffect(() => {
    if (pin.length === 4) {
      void (async () => {
        const ok = await unlock(pin);
        if (!ok) {
          setErr("Incorrect PIN");
          setPin("");
        }
      })();
    }
  }, [pin, unlock]);

  const locked = remaining > 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-foreground">Enter your PIN</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Unlock LifeVault to continue
          </p>
        </div>
        <PinKeypad
          value={pin}
          onChange={(v) => { setErr(null); setPin(v); }}
          disabled={locked}
        />
        {locked ? (
          <p className="text-center text-sm text-warning mt-6">
            Too many attempts. Try again in {remaining}s
          </p>
        ) : err ? (
          <p className="text-center text-sm text-danger mt-6">{err}</p>
        ) : null}
      </div>
    </div>
  );
}
