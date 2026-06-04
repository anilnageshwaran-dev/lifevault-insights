import * as React from "react";
import { deriveKey, pinHash, randomSalt } from "./crypto";

interface MetaState {
  salt: string | null;
  pinHash: string | null;
  onboardingComplete: boolean;
  autoLockMin: number; // -1 = never
  displayName: string;
  connectionId: string | null;
  lastSync: number | null;
  lastLogin: number | null;
}

const DEFAULT_META: MetaState = {
  salt: null,
  pinHash: null,
  onboardingComplete: false,
  autoLockMin: 5,
  displayName: "",
  connectionId: null,
  lastSync: null,
  lastLogin: null,
};

const META_KEY = "lifevault_meta";

interface LockCtx {
  meta: MetaState;
  updateMeta: (patch: Partial<MetaState>) => void;
  key: CryptoKey | null;
  locked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
  setupPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  changePin: (current: string, next: string) => Promise<boolean>;
  resetAll: () => void;
  completeOnboarding: () => void;
}

const Ctx = React.createContext<LockCtx | null>(null);

function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_META;
}
function saveMeta(m: MetaState) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = React.useState<MetaState>(DEFAULT_META);
  const [key, setKey] = React.useState<CryptoKey | null>(null);
  const [failedAttempts, setFailed] = React.useState(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setMeta(loadMeta());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) saveMeta(meta);
  }, [meta, hydrated]);

  // Auto-lock on visibility change
  React.useEffect(() => {
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const elapsed = (Date.now() - hiddenAt) / 60000;
        hiddenAt = null;
        if (meta.autoLockMin > 0 && elapsed >= meta.autoLockMin) setKey(null);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [meta.autoLockMin]);

  const updateMeta = React.useCallback((patch: Partial<MetaState>) => {
    setMeta((m) => ({ ...m, ...patch }));
  }, []);

  const setupPin = React.useCallback(async (pin: string) => {
    const salt = randomSalt();
    const ph = await pinHash(pin, salt);
    const k = await deriveKey(pin, salt);
    setKey(k);
    setMeta((m) => ({ ...m, salt, pinHash: ph, lastLogin: Date.now() }));
  }, []);

  const unlock = React.useCallback(
    async (pin: string): Promise<boolean> => {
      if (lockoutUntil && Date.now() < lockoutUntil) return false;
      if (!meta.salt || !meta.pinHash) return false;
      const ph = await pinHash(pin, meta.salt);
      if (ph !== meta.pinHash) {
        const f = failedAttempts + 1;
        setFailed(f);
        if (f >= 5) {
          setLockoutUntil(Date.now() + 30_000);
          setFailed(0);
        }
        return false;
      }
      const k = await deriveKey(pin, meta.salt);
      setKey(k);
      setFailed(0);
      setLockoutUntil(null);
      setMeta((m) => ({ ...m, lastLogin: Date.now() }));
      return true;
    },
    [meta.salt, meta.pinHash, failedAttempts, lockoutUntil],
  );

  const lock = React.useCallback(() => setKey(null), []);

  const changePin = React.useCallback(
    async (current: string, next: string): Promise<boolean> => {
      if (!meta.salt || !meta.pinHash) return false;
      const cur = await pinHash(current, meta.salt);
      if (cur !== meta.pinHash) return false;
      const salt = randomSalt();
      const ph = await pinHash(next, salt);
      const k = await deriveKey(next, salt);
      // The encrypted cache will be re-written by the finance provider on next state change.
      // Force an immediate re-encryption by clearing cache; FinanceProvider will re-save current state.
      try {
        localStorage.removeItem("lifevault_cache");
      } catch {}
      setKey(k);
      setMeta((m) => ({ ...m, salt, pinHash: ph }));
      return true;
    },
    [meta.salt, meta.pinHash],
  );

  const completeOnboarding = React.useCallback(() => {
    setMeta((m) => ({ ...m, onboardingComplete: true }));
  }, []);

  const resetAll = React.useCallback(() => {
    try {
      localStorage.removeItem("lifevault_cache");
      localStorage.removeItem("lifevault_data");
    } catch {}
    setKey(null);
    setMeta({ ...DEFAULT_META, onboardingComplete: true });
  }, []);

  return (
    <Ctx.Provider
      value={{
        meta,
        updateMeta,
        key,
        locked: !key,
        failedAttempts,
        lockoutUntil,
        setupPin,
        unlock,
        lock,
        changePin,
        resetAll,
        completeOnboarding,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLock() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useLock outside provider");
  return c;
}
