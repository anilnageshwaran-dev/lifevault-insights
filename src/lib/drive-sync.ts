// Google Drive appdata sync — per-user OAuth via Google Identity Services.

export const GOOGLE_CLIENT_ID =
  "244566667720-r1m69sp9eurfg2iguo8p7le0qqamcbvq.apps.googleusercontent.com";

export const DRIVE_SCOPES =
  "openid email profile https://www.googleapis.com/auth/drive.appdata";

export const DRIVE_FILE_NAME = "lifevault_data.json";

// GSI types (minimal)
type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
};
type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;

export function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load GSI"));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

export function getAccessTokenInMemory(): string | null {
  if (!accessToken) return null;
  if (Date.now() > tokenExpiresAt - 30_000) return null;
  return accessToken;
}

export function setAccessToken(token: string | null, expiresInSec = 3600) {
  accessToken = token;
  tokenExpiresAt = token ? Date.now() + expiresInSec * 1000 : 0;
}

async function ensureTokenClient(): Promise<TokenClient> {
  await loadGsi();
  if (tokenClient) return tokenClient;
  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPES,
    callback: () => {},
  });
  return tokenClient;
}

export async function requestToken(opts: { silent: boolean }): Promise<string> {
  const client = await ensureTokenClient();
  return new Promise<string>((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error_description || resp.error || "OAuth failed"));
        return;
      }
      setAccessToken(resp.access_token, resp.expires_in ?? 3600);
      resolve(resp.access_token);
    };
    try {
      client.requestAccessToken({ prompt: opts.silent ? "" : "consent" });
    } catch (e) {
      reject(e as Error);
    }
  });
}

export async function getValidToken(): Promise<string> {
  const t = getAccessTokenInMemory();
  if (t) return t;
  return requestToken({ silent: true });
}

export async function revokeToken(): Promise<void> {
  const t = accessToken;
  setAccessToken(null);
  if (!t) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {}
}

export interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

export async function fetchUserInfo(token: string): Promise<UserInfo | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as UserInfo;
  } catch {
    return null;
  }
}

// ---------- Drive REST ----------

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function authedFetch(
  url: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const token = await getValidToken();
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (r.status === 401 && retry) {
    setAccessToken(null);
    await requestToken({ silent: true });
    return authedFetch(url, init, false);
  }
  return r;
}

export async function findAppFile(): Promise<{ id: string; modifiedTime?: string } | null> {
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}'`);
  const r = await authedFetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`,
  );
  if (!r.ok) throw new Error(`Drive list failed: ${r.status}`);
  const j = (await r.json()) as { files?: Array<{ id: string; modifiedTime?: string }> };
  return j.files && j.files.length ? j.files[0] : null;
}

export async function downloadAppFile(fileId: string): Promise<string> {
  const r = await authedFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  if (!r.ok) throw new Error(`Drive download failed: ${r.status}`);
  return r.text();
}

export async function createAppFile(content: string): Promise<string> {
  const boundary = "lvbnd_" + Math.random().toString(36).slice(2);
  const meta = { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  const r = await authedFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`Drive create failed: ${r.status}`);
  const j = (await r.json()) as { id: string };
  return j.id;
}

export async function updateAppFile(fileId: string, content: string): Promise<void> {
  const r = await authedFetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "text/plain" },
      body: content,
    },
  );
  if (!r.ok) throw new Error(`Drive update failed: ${r.status}`);
}
