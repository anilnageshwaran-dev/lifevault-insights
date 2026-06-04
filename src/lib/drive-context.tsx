import * as React from "react";
import {
  fetchUserInfo,
  getValidToken,
  loadGsi,
  requestToken,
  revokeToken,
  type UserInfo,
} from "./drive-sync";
import { useAuth } from "./auth-context";

const PREF_KEY = "lifevault_drive_pref";
const AUTO_ATTEMPT_KEY = "lifevault_drive_auto_attempted";

interface DrivePref {
  connected: boolean;
  email?: string;
  name?: string;
}

interface DriveCtx {
  connected: boolean;
  user: UserInfo | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  ensureToken: () => Promise<string | null>;
}

const Ctx = React.createContext<DriveCtx | null>(null);

function loadPref(): DrivePref {
  try {
    const r = localStorage.getItem(PREF_KEY);
    if (r) return JSON.parse(r);
  } catch {}
  return { connected: false };
}
function savePref(p: DrivePref) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {}
}

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [pref, setPref] = React.useState<DrivePref>({ connected: false });
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [connecting, setConnecting] = React.useState(false);

  // Hydrate pref and preload GSI
  React.useEffect(() => {
    setPref(loadPref());
    void loadGsi().catch(() => {});
  }, []);

  // Auto-reconnect silently on launch (and again when network returns)
  React.useEffect(() => {
    if (!pref.connected) return;
    let cancelled = false;
    const hint = pref.email;
    const attempt = async () => {
      try {
        const tok = await requestToken({ silent: true, hint });
        if (cancelled) return;
        const info = await fetchUserInfo(tok);
        if (cancelled) return;
        if (info) setUser(info);
      } catch {
        // Silent refresh failed — user will see "Reconnect" affordance in Settings.
      }
    };
    void attempt();
    const onOnline = () => void attempt();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [pref.connected, pref.email]);

  // Auto-connect Drive once after Google sign-in, using the signed-in email as
  // an account hint so the user only sees the Drive consent screen (no
  // account picker) — and only if Drive isn't already linked.
  React.useEffect(() => {
    if (!authUser) return;
    if (pref.connected) return;

    const provider =
      (authUser.app_metadata as { provider?: string } | undefined)?.provider ??
      authUser.identities?.[0]?.provider;
    if (provider !== "google") return;

    const email = authUser.email;
    if (!email) return;

    let attempted = false;
    try {
      attempted = sessionStorage.getItem(AUTO_ATTEMPT_KEY) === "1";
    } catch {}
    if (attempted) return;
    try {
      sessionStorage.setItem(AUTO_ATTEMPT_KEY, "1");
    } catch {}

    let cancelled = false;
    void (async () => {
      // 1) Try silent first — succeeds if Drive scope was previously granted.
      try {
        const tok = await requestToken({ silent: true, hint: email });
        const info = await fetchUserInfo(tok);
        if (cancelled) return;
        if (info) setUser(info);
        const next: DrivePref = {
          connected: true,
          email: info?.email ?? email,
          name: info?.name,
        };
        setPref(next);
        savePref(next);
        return;
      } catch {
        // Need consent.
      }
      // 2) Pop a consent prompt prefilled with the signed-in email.
      try {
        setConnecting(true);
        const tok = await requestToken({ silent: false, hint: email });
        const info = await fetchUserInfo(tok);
        if (cancelled) return;
        if (info) setUser(info);
        const next: DrivePref = {
          connected: true,
          email: info?.email ?? email,
          name: info?.name,
        };
        setPref(next);
        savePref(next);
      } catch {
        // User declined — they can connect manually from Settings.
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, pref.connected]);

  const connect = React.useCallback(async () => {
    setConnecting(true);
    try {
      const hint = authUser?.email;
      const tok = await requestToken({ silent: false, hint });
      const info = await fetchUserInfo(tok);
      setUser(info);
      const next: DrivePref = {
        connected: true,
        email: info?.email,
        name: info?.name,
      };
      setPref(next);
      savePref(next);
    } finally {
      setConnecting(false);
    }
  }, [authUser?.email]);

  const disconnect = React.useCallback(async () => {
    await revokeToken();
    setUser(null);
    setPref({ connected: false });
    savePref({ connected: false });
    try {
      localStorage.removeItem("lifevault_drive_fileid");
      sessionStorage.removeItem(AUTO_ATTEMPT_KEY);
    } catch {}
  }, []);

  const ensureToken = React.useCallback(async (): Promise<string | null> => {
    if (!pref.connected) return null;
    try {
      return await getValidToken();
    } catch {
      return null;
    }
  }, [pref.connected]);

  return (
    <Ctx.Provider
      value={{
        connected: pref.connected,
        user,
        connecting,
        connect,
        disconnect,
        ensureToken,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDrive() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useDrive outside DriveProvider");
  return c;
}
