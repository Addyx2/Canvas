import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken, signIdToken } from "@/lib/aultrum-id/tokens";
import { authenticateClient, redeemCode } from "@/lib/aultrum-id/oidc";

export const dynamic = "force-dynamic";

const error = (status: number, code: string, description: string) =>
  Response.json({ error: code, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });

// OpenID Connect token endpoint: exchanges a one-time code for tokens.
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return error(400, "invalid_request", "Send a form-encoded body");
  }
  const form = new URLSearchParams(await request.text());
  const client = await authenticateClient(request, form);
  if (!client) return error(401, "invalid_client", "Unknown client or wrong secret");
  if (form.get("grant_type") !== "authorization_code") return error(400, "unsupported_grant_type", "Only authorization_code is supported");

  const code = await redeemCode(client, form.get("code") ?? "", form.get("redirect_uri") ?? "", form.get("code_verifier") ?? "");
  if (!code) return error(400, "invalid_grant", "The code is invalid, expired, already used or doesn't match");

  const claims = { sub: code.identity.id, email: code.identity.email, name: code.identity.name };
  return Response.json(
    {
      token_type: "Bearer",
      access_token: await signAccessToken(claims.sub, client.clientId, code.scope),
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      id_token: await signIdToken(claims, client.clientId, code.nonce),
      scope: code.scope,
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}
