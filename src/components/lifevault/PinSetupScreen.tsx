import * as React from "react";
import { Vault } from "lucide-react";
import { PinKeypad } from "./PinKeypad";
import { useLock } from "@/lib/lock-context";
import { LifeVaultIcon } from "./LifeVaultIcon";

export function PinSetupScreen() {
  const { setupPin } = useLock();
  const [step, setStep] = React.useState<"create" | "confirm">("create");
  const [pin, setPin] = React.useState("");
  const [first, setFirst] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pin.length === 4) {
      if (step === "create") {
        setFirst(pin);
        setStep("confirm");
        setPin("");
      } else {
        if (pin === first) {
          void setupPin(pin);
        } else {
          setErr("PINs don't match. Try again.");
          setStep("create");
          setFirst("");
          setPin("");
        }
      }
    }
  }, [pin, step, first, setupPin]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LifeVaultIcon className="mx-auto h-14 w-14 mb-4" />
          <h1 className="font-display text-2xl text-foreground">
            {step === "create" ? "Create your 4-digit vault PIN" : "Confirm your PIN"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "create"
              ? "Used to encrypt your data. Choose something memorable."
              : "Enter the same PIN again to confirm."}
          </p>
        </div>
        <PinKeypad value={pin} onChange={(v) => { setErr(null); setPin(v); }} />
        {err && <p className="text-center text-sm text-danger mt-4">{err}</p>}
        <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Vault className="h-3.5 w-3.5" /> LifeVault · zero-knowledge encrypted
        </div>
      </div>
    </div>
  );
}
