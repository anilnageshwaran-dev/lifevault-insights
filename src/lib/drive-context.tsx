import * as React from "react";
import {
  fetchUserInfo,
  getValidToken,
  loadGsi,
  requestToken,
  revokeToken,
  type UserInfo,
} from "./drive-sync";

const PREF_KEY = "lifevault_drive_pref";

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
    const attempt = async () => {
      try {
        const tok = await requestToken({ silent: true });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref.connected]);

  const connect = React.useCallback(async () => {
    setConnecting(true);
    try {
      const tok = await requestToken({ silent: false });
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
  }, []);

  const disconnect = React.useCallback(async () => {
    await revokeToken();
    setUser(null);
    setPref({ connected: false });
    savePref({ connected: false });
    try {
      localStorage.removeItem("lifevault_drive_fileid");
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
