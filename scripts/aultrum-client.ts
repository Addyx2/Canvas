// Registers or updates a product that signs in with Aultrum ID, and prints
// its client secret (shown only when created or rotated).
//
//   npx tsx scripts/aultrum-client.ts --product pleasant --name Pleasant \
//     --app https://pleasant.aultrum.co.uk [--rotate]
//
// For a product at --app, it registers the redirect address
// <app>/api/auth/aultrum/callback, the post-logout address <app>/login and
// the Workspace launch address <app>/api/auth/aultrum/start.
import { randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { clientRecord } from "../lib/aultrum-id/clients";
import { hashSecret } from "../lib/credentials";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const product = arg("product");
  const name = arg("name");
  const app = arg("app")?.replace(/\/+$/, "");
  if (!product || !name || !app) throw new Error("Usage: --product <key> --name <name> --app <https://product.example>");
  const clientId = `aid_${product}`;
  const data = clientRecord(product, name, app);
  const existing = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (existing && !process.argv.includes("--rotate")) {
    await prisma.oAuthClient.update({ where: { clientId }, data });
    console.log(`Updated ${clientId}. Secret unchanged (pass --rotate for a new one).`);
    return;
  }
  const secret = `aids_${randomBytes(24).toString("base64url")}`;
  await prisma.oAuthClient.upsert({
    where: { clientId },
    create: { clientId, secretHash: hashSecret(secret), ...data },
    update: { secretHash: hashSecret(secret), revokedAt: null, ...data },
  });
  console.log(`Client ID:     ${clientId}\nClient secret: ${secret}\n\nStore the secret in the product's environment now; it isn't shown again.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
