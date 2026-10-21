// npm run restore -- backups/linkwell-production-2026-10-21.json
// Puts a backup into the database named by RESTORE_DATABASE_URL, which must
// be empty (create it, run the migrations, then restore). It never guesses
// the target: you always say which database, on purpose.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { countRows, restoreBackup } from "./backup-lib.mjs";

const file = process.argv[2];
const target = process.env.RESTORE_DATABASE_URL;
if (!file || !target) {
  console.error("Usage: RESTORE_DATABASE_URL=<empty database's connection string> npm run restore -- <backup file>");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
const error = await restoreBackup(neon(target), backup);
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`Restored ${file}:`);
console.table(countRows(backup));
