import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { FinanceProvider } from "@/lib/finance-context";
import { LockProvider, useLock } from "@/lib/lock-context";
import { ThemeProvider } from "@/lib/theme-context";
import { DriveProvider } from "@/lib/drive-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LifeVaultApp } from "./LifeVaultApp";
import { OnboardingScreen } from "./OnboardingScreen";
import { PinSetupScreen } from "./PinSetupScreen";
import { PinLockScreen } from "./PinLockScreen";
import { AuthScreen } from "./AuthScreen";
import { LandingScreen } from "./LandingScreen";
import { Loader2 } from "lucide-react";

function Gate() {
  const { meta, key } = useLock();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = React.useState(false);

  React.useEffect(() => {
    if (!session) return;
    try {
      const token = localStorage.getItem("lifevault_pending_invite");
      if (token) {
        localStorage.removeItem("lifevault_pending_invite");
        navigate({ to: "/accept-invite", search: { token } });
      }
    } catch {}
  }, [session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    if (showAuth) return <AuthScreen />;
    return <LandingScreen onUseEmail={() => setShowAuth(true)} />;
  }

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
      <AuthProvider>
        <LockProvider>
          <DriveProvider>
            <Gate />
          </DriveProvider>
        </LockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
