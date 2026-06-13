// Server-only AES-256-GCM helpers for credential vault.
// Format: base64( iv(12) | tag(16) | ciphertext )
//
// Key precedence:
//   1. CREDENTIAL_ENCRYPTION_KEY env var (any string — hashed to 32 bytes)
//   2. SUPABASE_SERVICE_ROLE_KEY (always present on the server, hashed to 32 bytes)
//
// The fallback ensures the vault works on every deployment without extra
// setup, while still being completely opaque to anyone without server access.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const source = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!source) throw new Error("No encryption key available on server");
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
