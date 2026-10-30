// Deploys the database before the app builds (vercel.json buildCommand):
// 1. A database made before migrations (by `prisma db push`) is marked as
//    already at the baseline, once.
// 2. Every newer migration in prisma/migrations is applied, in order.
// 3. The live database must then match prisma/schema.prisma exactly; if it
//    doesn't (a change made by hand, or a migration missing), the deploy stops
//    here instead of shipping code against the wrong tables.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";

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
// A migration that failed part-way stops every later deploy until it's resolved.
const failed = migrations ? await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL` : [];
await db.$disconnect();

if (tables > 0 && done.length === 0) {
  console.log(`Existing database without the ${baseline} record: marking it applied.`);
  prisma("migrate", "resolve", "--applied", baseline);
}
// One marked "-- idempotent: safe to re-run" is retried; any other needs a person.
for (const { migration_name: name } of failed) {
  const file = `prisma/migrations/${name}/migration.sql`;
  if (existsSync(file) && /^--\s*idempotent:\s*safe to re-run/m.test(readFileSync(file, "utf8"))) {
    console.log(`Migration ${name} failed before; it is safe to re-run, so retrying it.`);
    prisma("migrate", "resolve", "--rolled-back", name);
  } else {
    console.error(`Migration ${name} failed before and isn't marked safe to re-run. Check the database, then run: npx prisma migrate resolve --rolled-back ${name} (or --applied).`);
    process.exit(1);
  }
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
