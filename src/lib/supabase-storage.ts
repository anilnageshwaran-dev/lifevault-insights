// Encrypted vault sync via Supabase Storage.
// Each user's vault lives at: vaults/{user_id}/lifevault_data.json
// Supabase only ever sees the AES-256-GCM ciphertext envelope.

import { supabase } from "@/integrations/supabase/client";

export const VAULT_BUCKET = "vaults";
export const VAULT_FILE_NAME = "lifevault_data.json";

export function vaultPath(userId: string): string {
  return `${userId}/${VAULT_FILE_NAME}`;
}

export interface RemoteVaultInfo {
  modifiedTime: string | null;
}

function isNotFoundError(err: unknown): boolean {
  const e = err as { statusCode?: string | number; message?: string; error?: string };
  const code = String(e?.statusCode ?? "");
  if (code === "404") return true;
  const msg = (e?.message || e?.error || "").toLowerCase();
  return msg.includes("not found") || msg.includes("object not found");
}

/** Look up the user's vault file metadata, if it exists. */
export async function statVault(userId: string): Promise<RemoteVaultInfo | null> {
  const { data, error } = await supabase.storage
    .from(VAULT_BUCKET)
    .list(userId, { search: VAULT_FILE_NAME, limit: 1 });
  if (error) return null;
  const f = data?.find((x) => x.name === VAULT_FILE_NAME);
  if (!f) return null;
  const updated = (f as { updated_at?: string; created_at?: string }).updated_at
    ?? (f as { created_at?: string }).created_at
    ?? null;
  return { modifiedTime: updated };
}

/** Download the encrypted vault for the user, or null if no file exists yet. */
export async function downloadVault(
  userId: string,
): Promise<{ content: string; info: RemoteVaultInfo } | null> {
  const { data, error } = await supabase.storage
    .from(VAULT_BUCKET)
    .download(vaultPath(userId));
  if (error) {
    if (isNotFoundError(error)) return null;
    throw new Error(error.message || "Vault download failed");
  }
  const content = await data.text();
  const info = (await statVault(userId)) ?? { modifiedTime: null };
  return { content, info };
}

/** Upload (or overwrite) the encrypted vault for the user. */
export async function uploadVault(
  userId: string,
  encrypted: string,
): Promise<RemoteVaultInfo> {
  const path = vaultPath(userId);
  console.log("[vault] Saving vault for user:", userId);
  console.log("[vault] Upload path:", path);
  const { data: { session } } = await supabase.auth.getSession();
  console.log("[vault] Session active:", !!session);
  console.log("[vault] Session user id:", session?.user?.id);
  if (!session) {
    throw new Error("Cannot upload vault: no active Supabase session");
  }
  if (session.user?.id !== userId) {
    throw new Error(
      `Vault upload aborted: session user (${session.user?.id}) does not match vault user (${userId})`,
    );
  }
  const blob = new Blob([encrypted], { type: "application/json" });
  const { error } = await supabase.storage
    .from(VAULT_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: "application/json",
    });
  console.log("[vault] Upload result:", error ? error.message : "ok", {
    bytes: encrypted.length,
  });
  if (error) throw new Error(error.message || "Vault upload failed");
  return (await statVault(userId)) ?? { modifiedTime: null };
}
