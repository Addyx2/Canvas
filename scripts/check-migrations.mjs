// CI: every change to prisma/schema.prisma comes with a migration, and no
// migration drops or rewrites data unless someone has reviewed it and marked
// it `-- destructive: reviewed`.
import { readdirSync, readFileSync } from "node:fs";

const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|INDEX|TYPE)|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE|ALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL|RENAME\s+(COLUMN|TO)|TRUNCATE|DELETE\s+FROM)\b/i;
const problems = [];
for (const dir of readdirSync("prisma/migrations").filter((d) => !d.startsWith("0_") && !d.endsWith(".toml")).sort()) {
  const sql = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8");
  const hit = sql.split("\n").find((line) => DESTRUCTIVE.test(line) && !line.trim().startsWith("--"));
  if (hit && !/--\s*destructive:\s*reviewed/i.test(sql)) problems.push(`${dir}: ${hit.trim()}`);
}
if (problems.length) {
  console.error("Destructive migration steps need review (add `-- destructive: reviewed` once checked):\n" + problems.join("\n"));
  process.exit(1);
}
console.log("Migrations: no unreviewed destructive steps.");
