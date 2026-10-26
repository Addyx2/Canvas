import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { authSecret } from "./secret";

// Encrypts credentials an organisation gives Canvas (e.g. a Twilio auth
// token) before they are stored. AES-256-GCM with a key derived from the
// signing secret, so a database dump alone doesn't reveal them.

async function key(): Promise<Buffer> {
  return createHash("sha256").update(`elements-seal:${await authSecret()}`).digest();
}

export async function seal(plain: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export async function unseal(sealed: string | null | undefined): Promise<string | null> {
  if (!sealed) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", await key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
