// CI: every migration after the baseline must
// - not drop or rewrite data unless someone has reviewed it and marked it
//   `-- destructive: reviewed`, and
// - be safe to run again (`-- idempotent: safe to re-run` on its first line,
//   using IF NOT EXISTS and the like), so a deploy that stopped half way
//   through can simply be retried. A migration that can't be written that way
//   says so with `-- not re-runnable: reviewed`.
import { readdirSync, readFileSync } from "node:fs";

const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|INDEX|TYPE)|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE|ALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL|RENAME\s+(COLUMN|TO)|TRUNCATE|DELETE\s+FROM)\b/i;
const IDEMPOTENT = /^--\s*idempotent:\s*safe to re-run/;
const NOT_RERUNNABLE = /--\s*not re-runnable:\s*reviewed/i;
const problems = [];
for (const dir of readdirSync("prisma/migrations").filter((d) => !d.startsWith("0_") && !d.endsWith(".toml")).sort()) {
  const sql = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8");
  const hit = sql.split("\n").find((line) => DESTRUCTIVE.test(line) && !line.trim().startsWith("--"));
  if (hit && !/--\s*destructive:\s*reviewed/i.test(sql)) problems.push(`${dir}: destructive step needs review (add \`-- destructive: reviewed\` once checked): ${hit.trim()}`);
  if (!IDEMPOTENT.test(sql) && !NOT_RERUNNABLE.test(sql)) {
    problems.push(`${dir}: make it safe to re-run (IF NOT EXISTS, and \`-- idempotent: safe to re-run\` as its first line), or mark it \`-- not re-runnable: reviewed\``);
  }
}
if (problems.length) {
  console.error("Migrations need attention:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("Migrations: re-runnable, and no unreviewed destructive steps.");
