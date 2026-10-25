import { createHash, generateKeyPairSync } from "node:crypto";

import { exportJWK, importPKCS8, importSPKI, type JWK, type KeyLike } from "jose";

// Aultrum ID signs ID and access tokens with RS256. The private key is
// AULTRUM_ID_SIGNING_KEY (PKCS#8 PEM). Products verify tokens with the
// public key published at /jwks. In development a key is generated per
// process; in production the variable is required.

interface SigningKey {
  kid: string;
  privateKey: KeyLike;
  publicJwk: JWK;
}

let cached: Promise<SigningKey> | null = null;

async function load(): Promise<SigningKey> {
  let privatePem = process.env.AULTRUM_ID_SIGNING_KEY?.replace(/\\n/g, "\n");
  let publicPem: string;
  if (privatePem) {
    const { createPrivateKey, createPublicKey } = await import("node:crypto");
    publicPem = createPublicKey(createPrivateKey(privatePem)).export({ type: "spki", format: "pem" }).toString();
  } else {
    if (process.env.NODE_ENV === "production" && !process.env.AULTRUM_ID_DEV_KEYS) {
      throw new Error("AULTRUM_ID_SIGNING_KEY must be set in production");
    }
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    publicPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  }
  const privateKey = await importPKCS8(privatePem, "RS256");
  const publicJwk = await exportJWK(await importSPKI(publicPem, "RS256"));
  const kid = createHash("sha256").update(`${publicJwk.n}.${publicJwk.e}`).digest("base64url").slice(0, 16);
  return { kid, privateKey, publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" } };
}

export function signingKey(): Promise<SigningKey> {
  cached ??= load().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}

export async function jwks(): Promise<{ keys: JWK[] }> {
  return { keys: [(await signingKey()).publicJwk] };
}
