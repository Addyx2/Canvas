// Deploys the database before the app builds (vercel.json buildCommand):
// 1. A database made before migrations (by `prisma db push`) is marked as
//    already at the baseline, once.
// 2. Every newer migration in prisma/migrations is applied, in order.
// 3. The live database must then match prisma/schema.prisma exactly; if it
//    doesn't (a change made by hand, or a migration missing), the deploy stops
//    here instead of shipping code against the wrong tables.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

// Locally, DATABASE_URL comes from .env (Vercel sets it in the environment).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env: Prisma reports the missing URL below
  }
}

const prisma = (...args) => execFileSync("npx", ["prisma", ...args], { stdio: "inherit" });
const baseline = readdirSync("prisma/migrations").filter((d) => /^0_/.test(d)).sort()[0];
if (!baseline) throw new Error("No baseline migration (prisma/migrations/0_*) found");

prisma("generate");
const db = new PrismaClient();
const [{ migrations, tables }] = await db.$queryRaw`
  SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS migrations,
         (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations') AS tables`;
const done = migrations ? await db.$queryRaw`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${baseline} AND finished_at IS NOT NULL` : [];
await db.$disconnect();

if (tables > 0 && done.length === 0) {
  console.log(`Existing database without the ${baseline} record: marking it applied.`);
  prisma("migrate", "resolve", "--applied", baseline);
}
prisma("migrate", "deploy");

try {
  execFileSync("npx", ["prisma", "migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], { stdio: "pipe" });
  console.log("Database matches prisma/schema.prisma.");
} catch (error) {
  if (error.status === 2) {
    console.error("The live database doesn't match prisma/schema.prisma. Differences:");
    execFileSync("npx", ["prisma", "migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { stdio: "inherit" });
    process.exit(1);
  }
  throw error;
}
