import * as React from "react";
import {
  decryptWithKey,
  deriveKey,
  encryptWithKey,
  pinHash,
  randomSalt,
  type VaultEnvelope,
} from "./crypto";

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
  encryptSyncData: (data: unknown) => Promise<string>;
  decryptSyncData: <T = unknown>(blob: string) => Promise<T>;
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
  const pinRef = React.useRef<string | null>(null);
  const keyRef = React.useRef<CryptoKey | null>(null);

  React.useEffect(() => {
    setMeta(loadMeta());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) saveMeta(meta);
  }, [meta, hydrated]);

  React.useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // Auto-lock on visibility change
  React.useEffect(() => {
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const elapsed = (Date.now() - hiddenAt) / 60000;
        hiddenAt = null;
        if (meta.autoLockMin > 0 && elapsed >= meta.autoLockMin) {
          pinRef.current = null;
          setKey(null);
        }
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
    pinRef.current = pin;
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
      pinRef.current = pin;
      setKey(k);
      setFailed(0);
      setLockoutUntil(null);
      setMeta((m) => ({ ...m, lastLogin: Date.now() }));
      return true;
    },
    [meta.salt, meta.pinHash, failedAttempts, lockoutUntil],
  );

  const lock = React.useCallback(() => {
    pinRef.current = null;
    setKey(null);
  }, []);

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
      pinRef.current = next;
      setKey(k);
      setMeta((m) => ({ ...m, salt, pinHash: ph }));
      return true;
    },
    [meta.salt, meta.pinHash],
  );

  const encryptSyncData = React.useCallback(async (data: unknown): Promise<string> => {
    const pin = pinRef.current;
    if (!pin) throw new Error("Unlock LifeVault before syncing Drive data");
    const salt = randomSalt();
    const syncKey = await deriveKey(pin, salt);
    const envelope: VaultEnvelope = {
      v: 1,
      salt,
      pinHash: await pinHash(pin, salt),
      data: await encryptWithKey(data, syncKey),
    };
    return JSON.stringify(envelope);
  }, []);

  const decryptSyncData = React.useCallback(async <T = unknown,>(blob: string): Promise<T> => {
    const pin = pinRef.current;
    const trimmed = blob.trim();
    try {
      const parsed = JSON.parse(trimmed) as Partial<VaultEnvelope>;
      if (parsed?.v === 1 && parsed.salt && parsed.data && parsed.pinHash) {
        if (!pin) throw new Error("Unlock LifeVault before syncing Drive data");
        const expected = await pinHash(pin, parsed.salt);
        if (expected !== parsed.pinHash) throw new Error("PIN mismatch");
        const syncKey = await deriveKey(pin, parsed.salt);
        return decryptWithKey<T>(parsed.data, syncKey);
      }
    } catch (error) {
      if ((error as Error).message === "PIN mismatch") throw error;
    }

    const localKey = keyRef.current;
    if (!localKey) throw new Error("Unlock LifeVault before syncing Drive data");
    try {
      return await decryptWithKey<T>(trimmed, localKey);
    } catch {
      throw new Error("This older Drive sync file was encrypted by another device. Open that device after publishing, then tap Sync now once.");
    }
  }, []);

  const completeOnboarding = React.useCallback(() => {
    setMeta((m) => ({ ...m, onboardingComplete: true }));
  }, []);

  const resetAll = React.useCallback(() => {
    try {
      localStorage.removeItem("lifevault_cache");
      localStorage.removeItem("lifevault_data");
    } catch {}
    pinRef.current = null;
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
        encryptSyncData,
        decryptSyncData,
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
