import { MODULES } from "@/lib/modules";

/** The module catalogue, with each manifest. Public: it describes the contract. */
export function GET() {
  return Response.json({ modules: MODULES });
}
