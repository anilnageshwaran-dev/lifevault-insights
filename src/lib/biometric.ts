// WebAuthn-based biometric unlock for LifeVault.
//
// Pragmatic design (offline-only, no server):
//   • On enroll: create a platform credential (Face ID / Touch ID / Windows Hello)
//     with userVerification=required. Store the credential id locally and the
//     user's PIN encrypted with a key derived from that credential id.
//   • On unlock: navigator.credentials.get() forces the OS biometric prompt.
//     Only on a successful assertion do we decrypt the PIN and feed it to lock-context.
//
// The cipher key is derived from data that lives in localStorage, so this is a
// UX gate (biometric instead of PIN entry), not a stronger crypto layer. The
// underlying vault is still PBKDF2-derived from the PIN.
import {
  deriveKey,
  encryptWithKey,
  decryptWithKey,
  randomSalt,
  fromB64,
  toB64,
} from "./crypto";

const BIO_KEY = "lifevault_bio_v1";

interface BioRecord {
  credentialId: string; // base64url
  saltHex: string;
  ciphertext: string; // PIN encrypted
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnrolled(): boolean {
  try {
    return !!localStorage.getItem(BIO_KEY);
  } catch {
    return false;
  }
}

export function disableBiometric() {
  try {
    localStorage.removeItem(BIO_KEY);
  } catch {}
}

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export async function enrollBiometric(pin: string, displayName = "LifeVault"): Promise<void> {
  if (!(await isPlatformAuthenticatorAvailable())) {
    throw new Error("Biometric authentication is not available on this device");
  }
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "LifeVault" },
      user: {
        id: userId,
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric enrollment cancelled");

  const credentialId = b64urlFromBytes(cred.rawId);
  const saltHex = randomSalt();
  // Key material = credential id (deterministic, only ever returned via WebAuthn)
  const key = await deriveKey(credentialId, saltHex);
  const ciphertext = await encryptWithKey(pin, key);

  const record: BioRecord = { credentialId, saltHex, ciphertext };
  localStorage.setItem(BIO_KEY, JSON.stringify(record));
}

export async function unlockWithBiometric(): Promise<string> {
  const raw = localStorage.getItem(BIO_KEY);
  if (!raw) throw new Error("Biometric unlock is not set up");
  const record = JSON.parse(raw) as BioRecord;

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const allowId = bytesFromB64url(record.credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: allowId.buffer.slice(allowId.byteOffset, allowId.byteOffset + allowId.byteLength) as ArrayBuffer,
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Biometric unlock cancelled");

  const key = await deriveKey(record.credentialId, record.saltHex);
  const pin = await decryptWithKey<string>(record.ciphertext, key);
  if (typeof pin !== "string" || pin.length < 4) throw new Error("Stored PIN is invalid");
  return pin;
}
