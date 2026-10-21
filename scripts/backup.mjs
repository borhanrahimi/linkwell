// npm run backup: saves Linkwell's data to backups/linkwell-<source>-<date>.json.
// Reads the real database (PROD_DATABASE_URL in .env.local) by default;
// `npm run backup -- --from test` reads the test database instead.
// It only reads: nothing in the database changes.
import { mkdirSync, writeFileSync } from "node:fs";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { countRows, takeBackup } from "./backup-lib.mjs";

nextEnv.loadEnvConfig(process.cwd());

const source = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "production";
const variable = { production: "PROD_DATABASE_URL", test: "E2E_DATABASE_URL" }[source];
if (!variable || !process.env[variable]) {
  console.error(`Can't back up "${source}": ${variable ?? "PROD_DATABASE_URL or E2E_DATABASE_URL"} isn't set in .env.local.`);
  process.exit(1);
}

const backup = await takeBackup(neon(process.env[variable]), source);
mkdirSync("backups", { recursive: true });
const file = `backups/linkwell-${source}-${backup.takenAt.slice(0, 10)}.json`;
// Only you can read the file: it holds people's emails and links.
writeFileSync(file, JSON.stringify(backup, null, 2), { mode: 0o600 });

console.log(`Saved ${file}`);
console.table(countRows(backup));
console.log("Keep a copy somewhere other than this computer too (an external drive or your own cloud storage).");
