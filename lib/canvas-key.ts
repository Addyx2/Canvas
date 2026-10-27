import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";

import { prisma } from "./db";
import { appUrl } from "./utils";

// Canvas's own signing key, made on first use and kept in the database, so
// webhooks to key-based systems are signed without any secret to share. Its
// public half is published at /.well-known/jwks.json.

const NAME = "webhook-signing-key";
let cached: Promise<{ privateJwk: JWK; publicJwk: JWK }> | null = null;

function load() {
  cached ??= (async () => {
    let row = await prisma.serviceKey.findUnique({ where: { name: NAME } });
    if (!row) {
      const { privateKey } = await generateKeyPair("ES256", { extractable: true });
      const jwk = await exportJWK(privateKey);
      await prisma.serviceKey.createMany({ data: [{ name: NAME, value: JSON.stringify(jwk) }], skipDuplicates: true });
      row = await prisma.serviceKey.findUniqueOrThrow({ where: { name: NAME } });
    }
    const privateJwk = JSON.parse(row.value) as JWK;
    const { d: _d, ...pub } = privateJwk;
    const kid = `canvas-${Buffer.from(pub.x ?? "").toString("base64url").slice(0, 12)}`;
    return { privateJwk: { ...privateJwk, kid }, publicJwk: { ...pub, kid, alg: "ES256", use: "sig" } };
  })().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}

export async function canvasJwks() {
  return { keys: [(await load()).publicJwk] };
}

/** A short-lived token proving a webhook body came from Canvas. */
export async function signWebhookJwt(body: string, audience: string, eventId: string): Promise<string> {
  const { privateJwk } = await load();
  const key = await importJWK(privateJwk, "ES256");
  const { createHash } = await import("node:crypto");
  return new SignJWT({ body_sha256: createHash("sha256").update(body).digest("base64url") })
    .setProtectedHeader({ alg: "ES256", kid: privateJwk.kid })
    .setIssuer(new URL(appUrl()).origin)
    .setAudience(audience)
    .setJti(eventId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
