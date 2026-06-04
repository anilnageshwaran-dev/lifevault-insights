import * as React from "react";
import { PinKeypad } from "./PinKeypad";
import { useLock } from "@/lib/lock-context";
import { LifeVaultIcon } from "./LifeVaultIcon";
import { Fingerprint } from "lucide-react";
import {
  isBiometricEnrolled,
  isPlatformAuthenticatorAvailable,
  unlockWithBiometric,
  disableBiometric,
} from "@/lib/biometric";

export function PinLockScreen() {
  const { unlock, lockoutUntil } = useLock();
  const [pin, setPin] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState(0);
  const [bioAvail, setBioAvail] = React.useState(false);
  const [bioBusy, setBioBusy] = React.useState(false);
  const triedAutoRef = React.useRef(false);

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

  const tryBiometric = React.useCallback(async () => {
    setErr(null);
    setBioBusy(true);
    try {
      const pin = await unlockWithBiometric();
      const ok = await unlock(pin);
      if (!ok) setErr("Saved PIN no longer matches. Use your PIN.");
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!/cancel/i.test(msg)) setErr(msg || "Biometric unlock failed");
    } finally {
      setBioBusy(false);
    }
  }, [unlock]);

  // Detect biometric availability + auto-prompt on mount
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enrolled = isBiometricEnrolled();
      if (!enrolled) return;
      const avail = await isPlatformAuthenticatorAvailable();
      if (cancelled) return;
      if (!avail) {
        disableBiometric();
        return;
      }
      setBioAvail(true);
      if (!triedAutoRef.current && !locked) {
        triedAutoRef.current = true;
        void tryBiometric();
      }
    })();
    return () => { cancelled = true; };
  }, [tryBiometric, locked]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LifeVaultIcon className="mx-auto h-14 w-14 mb-4" />
          <h1 className="font-display text-2xl text-foreground">Enter your PIN</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Unlock LifeVault to continue
          </p>
        </div>
        <PinKeypad
          value={pin}
          onChange={(v) => { setErr(null); setPin(v); }}
          disabled={locked || bioBusy}
        />
        {bioAvail && !locked && (
          <button
            onClick={tryBiometric}
            disabled={bioBusy}
            className="mx-auto mt-6 flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            <Fingerprint className="h-4 w-4" />
            {bioBusy ? "Waiting…" : "Use biometric unlock"}
          </button>
        )}
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
