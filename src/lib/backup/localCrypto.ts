import * as Crypto from "expo-crypto";

export const ENCRYPTED_BACKUP_KIND = "cobalt-backup-encrypted";
export const ENCRYPTED_BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;

export interface EncryptedBackupEnvelope {
  kind: typeof ENCRYPTED_BACKUP_KIND;
  version: typeof ENCRYPTED_BACKUP_VERSION;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  saltB64: string;
  ivB64: string;
  payloadB64: string;
  summary?: Record<string, unknown>;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis === "undefined" || !globalThis.crypto?.subtle) {
    throw new Error("WebCrypto not available");
  }
  return globalThis.crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }
  throw new Error("Base64 encoding unavailable");
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  if (typeof atob !== "undefined") {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error("Base64 decoding unavailable");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  try {
    Crypto.getRandomValues(bytes);
    return bytes;
  } catch {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
      return bytes;
    }
    throw new Error("Secure random unavailable");
  }
}

function normalizeBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: normalizeBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: KEY_LENGTH_BITS,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackupPayload(
  payload: Uint8Array,
  password: string,
  summary?: Record<string, unknown>,
): Promise<EncryptedBackupEnvelope> {
  if (!password) throw new Error("Password required");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const subtle = getSubtleCrypto();
  const key = await deriveAesKey(password, salt);
  const encrypted = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: normalizeBufferSource(iv),
    },
    key,
    normalizeBufferSource(payload),
  );
  return {
    kind: ENCRYPTED_BACKUP_KIND,
    version: ENCRYPTED_BACKUP_VERSION,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    payloadB64: toBase64(new Uint8Array(encrypted)),
    summary,
  };
}

export async function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  password: string,
): Promise<Uint8Array> {
  if (!password) throw new Error("Password required");
  if (envelope.kind !== ENCRYPTED_BACKUP_KIND) throw new Error("Invalid encrypted backup envelope");
  const subtle = getSubtleCrypto();
  const salt = fromBase64(envelope.saltB64);
  const iv = fromBase64(envelope.ivB64);
  const ciphertext = fromBase64(envelope.payloadB64);
  const key = await deriveAesKey(password, salt);
  const plaintext = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: normalizeBufferSource(iv),
    },
    key,
    normalizeBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === ENCRYPTED_BACKUP_KIND &&
    typeof record.version === "number" &&
    typeof record.saltB64 === "string" &&
    typeof record.ivB64 === "string" &&
    typeof record.payloadB64 === "string"
  );
}
