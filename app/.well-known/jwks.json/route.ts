import { canvasJwks } from "@/lib/canvas-key";

export const dynamic = "force-dynamic";

/** Canvas's public key, for systems that check its signed webhooks. */
export async function GET() {
  return Response.json(await canvasJwks(), { headers: { "Cache-Control": "public, max-age=300" } });
}
