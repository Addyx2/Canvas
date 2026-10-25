import { createLocalJWKSet, jwtVerify, SignJWT } from "jose";

import { idUrl } from "./hosts";
import { jwks, signingKey } from "./keys";

export const ID_TOKEN_TTL_SECONDS = 300;
export const ACCESS_TOKEN_TTL_SECONDS = 600;

export interface IdentityClaims {
  sub: string;
  email: string;
  name: string;
}

export async function signIdToken(identity: IdentityClaims, clientId: string, nonce: string | null): Promise<string> {
  const key = await signingKey();
  return new SignJWT({ email: identity.email, email_verified: false, name: identity.name, ...(nonce ? { nonce } : {}) })
    .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "JWT" })
    .setIssuer(idUrl())
    .setSubject(identity.sub)
    .setAudience(clientId)
    .setIssuedAt()
    .setExpirationTime(`${ID_TOKEN_TTL_SECONDS}s`)
    .sign(key.privateKey);
}

export async function signAccessToken(sub: string, clientId: string, scope: string): Promise<string> {
  const key = await signingKey();
  return new SignJWT({ scope, client_id: clientId })
    .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "at+jwt" })
    .setIssuer(idUrl())
    .setSubject(sub)
    .setAudience(`${idUrl()}/userinfo`)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key.privateKey);
}

/** Checks an access token Aultrum ID issued. Returns its subject and scope, or null. */
export async function verifyAccessToken(token: string): Promise<{ sub: string; scope: string } | null> {
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(await jwks()), {
      issuer: idUrl(),
      audience: `${idUrl()}/userinfo`,
      typ: "at+jwt",
    });
    return payload.sub ? { sub: payload.sub, scope: String(payload.scope ?? "") } : null;
  } catch {
    return null;
  }
}
