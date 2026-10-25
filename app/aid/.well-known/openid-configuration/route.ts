import { idUrl } from "@/lib/aultrum-id/hosts";
import { SUPPORTED_SCOPES } from "@/lib/aultrum-id/oidc";

export const dynamic = "force-dynamic";

export function GET() {
  const issuer = idUrl();
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: SUPPORTED_SCOPES,
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      code_challenge_methods_supported: ["S256"],
      claims_supported: ["sub", "email", "email_verified", "name"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
