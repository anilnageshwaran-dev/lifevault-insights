import * as React from "react";
import { FinanceProvider } from "@/lib/finance-context";
import { LockProvider, useLock } from "@/lib/lock-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LifeVaultApp } from "./LifeVaultApp";
import { OnboardingScreen } from "./OnboardingScreen";
import { PinSetupScreen } from "./PinSetupScreen";
import { PinLockScreen } from "./PinLockScreen";

function Gate() {
  const { meta, key } = useLock();

  if (!meta.onboardingComplete) return <OnboardingScreen />;
  if (!meta.pinHash) return <PinSetupScreen />;
  if (!key) return <PinLockScreen />;

  return (
    <FinanceProvider>
      <LifeVaultApp />
    </FinanceProvider>
  );
}

export function AppRoot() {
  return (
    <ThemeProvider>
      <LockProvider>
        <Gate />
      </LockProvider>
    </ThemeProvider>
  );
}
