// What a backup holds and how it goes back in. Used by backup.mjs and
// restore.mjs (and the unit tests, with a fake database).
//
// Saved: users, their Google sign-in links (which Google account is which
// user), folders and links. Left out on purpose: sign-in tokens, sessions and
// one-time codes (secrets that expire anyway; everyone just signs in again)
// and rate-limit counters (temporary).

export const BACKUP_VERSION = 1;

// The columns of each table, in the order they go back in (users first, since
// the others point at them). Restoring only ever uses these names, never names
// read from a file, so a tampered file can't sneak SQL in.
export const TABLES = {
  user: ["id", "name", "email", "email_verified", "image", "username", "created_at", "updated_at"],
  account: ["id", "account_id", "provider_id", "user_id", "scope", "created_at", "updated_at"],
  // deleted_at: the Trash is backed up too, so a restore keeps it.
  folders: ["id", "name", "color", "icon", "parent_id", "came_from_folder_id", "user_id", "created_at", "deleted_at", "pinned_at", "position"],
  links: ["id", "url", "title", "tags", "note", "created_at", "status", "checked_at", "read_at", "folder_id", "came_from_folder_id", "image", "user_id", "deleted_at"],
};

const quoted = (name) => `"${name}"`;

// The folders' columns that point at other folders.
const FOLDER_LINKS = ["parent_id", "came_from_folder_id"];

// Columns that are newer than some backups, and what they hold when a file
// doesn't have them (position: v2.4, before that folders kept the order they
// were made in, which their created_at still gives).
const MISSING = { folders: { position: 0 } };

// sql.query(text, params) runs one query and returns its rows.
export async function takeBackup(sql, source) {
  const tables = {};
  for (const [table, columns] of Object.entries(TABLES)) {
    tables[table] = await sql.query(
      `select ${columns.map(quoted).join(", ")} from ${quoted(table)} order by "created_at", "id"`,
      []
    );
  }
  return { version: BACKUP_VERSION, source, takenAt: new Date().toISOString(), tables };
}

export function countRows(backup) {
  return Object.fromEntries(Object.entries(backup.tables).map(([table, rows]) => [table, rows.length]));
}

// Puts a backup into an EMPTY database (one with Linkwell's tables, from
// `npx drizzle-kit migrate`, but no users or links yet). Returns an error
// message instead of touching anything when it isn't safe.
export async function restoreBackup(sql, backup) {
  if (backup?.version !== BACKUP_VERSION || typeof backup.tables !== "object") {
    return "This isn't a Linkwell backup file (or it's from a newer version).";
  }
  for (const table of Object.keys(TABLES)) {
    if (!Array.isArray(backup.tables[table])) return `The backup has no "${table}" table.`;
  }

  for (const table of ["user", "links"]) {
    const [{ count }] = await sql.query(`select count(*)::int as count from ${quoted(table)}`, []);
    if (count > 0) {
      return `The target database already has data (${count} rows in "${table}"). Restore only into an empty database, so nothing gets mixed up or overwritten.`;
    }
  }

  // One transaction: either everything goes in, or nothing does.
  const queries = [];
  for (const [table, columns] of Object.entries(TABLES)) {
    for (const row of backup.tables[table]) {
      // Folders point at other folders, which may come later in the file
      // (a folder moved into a newer one). They go in pointing nowhere first;
      // the updates below link them up once every folder is in.
      const values = columns.map((column) =>
        FOLDER_LINKS.includes(column) && table === "folders" ? null : (row[column] ?? MISSING[table]?.[column] ?? null)
      );
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      queries.push(
        sql.query(`insert into ${quoted(table)} (${columns.map(quoted).join(", ")}) values (${placeholders})`, values)
      );
    }
  }
  for (const row of backup.tables.folders) {
    if (FOLDER_LINKS.some((column) => row[column])) {
      queries.push(
        sql.query(
          `update "folders" set ${FOLDER_LINKS.map((column, i) => `${quoted(column)} = $${i + 1}`).join(", ")} where "id" = $${FOLDER_LINKS.length + 1}`,
          [...FOLDER_LINKS.map((column) => row[column] ?? null), row.id]
        )
      );
    }
  }
  await sql.transaction(queries);
  return null;
}
