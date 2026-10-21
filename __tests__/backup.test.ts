import { describe, expect, test, vi } from "vitest";
import { restoreBackup, takeBackup, TABLES } from "../scripts/backup-lib.mjs";

// A pretend database: records every query, answers counts with `count`.
function fakeDatabase(count = 0) {
  const queries: { text: string; params: unknown[] }[] = [];
  return {
    queries,
    query: vi.fn(async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      return text.includes("count(*)") ? [{ count }] : [{ id: "row" }];
    }),
    transaction: vi.fn(async (list: unknown[]) => list),
  };
}

const backup = {
  version: 1,
  source: "production",
  takenAt: "2026-10-21T12:00:00.000Z",
  tables: {
    user: [{ id: "u1", name: "Sam", email: "sam@example.com", email_verified: true, created_at: "2026-10-01" }],
    // A tampered file: an extra column, and a "column name" that is really SQL.
    account: [{ id: "a1", account_id: "123", provider_id: "google", user_id: "u1", access_token: "secret", "x); drop table links; --": 1 }],
    folders: [{ id: "f1", name: "Recipes", user_id: "u1" }],
    links: [{ id: "l1", url: "https://example.com", tags: ["food"], folder_id: "f1", user_id: "u1" }],
  },
};

describe("taking a backup", () => {
  test("reads users, accounts, folders and links, but never sign-in tokens, sessions or one-time codes", async () => {
    const db = fakeDatabase();

    const result = await takeBackup(db, "test");

    expect(Object.keys(result.tables)).toEqual(["user", "account", "folders", "links"]);
    const everything = db.queries.map((q) => q.text).join("\n");
    for (const secret of ["access_token", "refresh_token", "id_token", "password", "session", "verification", "rate_limits"]) {
      expect(everything).not.toContain(secret);
    }
    // It only reads.
    expect(db.queries.every((q) => q.text.startsWith("select "))).toBe(true);
    expect(result).toMatchObject({ version: 1, source: "test" });
  });
});

describe("restoring a backup", () => {
  test("fills an empty database in one transaction, users first, with known columns only", async () => {
    const db = fakeDatabase(0);

    expect(await restoreBackup(db, backup)).toBeNull();

    expect(db.transaction).toHaveBeenCalledTimes(1);
    const inserts = db.queries.filter((q) => q.text.startsWith("insert"));
    expect(inserts.map((q) => q.text.match(/insert into "(\w+)"/)?.[1])).toEqual(["user", "account", "folders", "links"]);
    // The tampered column names never reach the database; values go as parameters.
    const accountInsert = inserts[1];
    expect(accountInsert.text).not.toContain("access_token");
    expect(accountInsert.text).not.toContain("drop table");
    expect(accountInsert.params).toHaveLength(TABLES.account.length);
    expect(inserts[3].params).toContain("https://example.com");
  });

  test("refuses a database that already has data, and changes nothing", async () => {
    const db = fakeDatabase(3);

    expect(await restoreBackup(db, backup)).toMatch(/already has data/);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.queries.some((q) => q.text.startsWith("insert"))).toBe(false);
  });

  test("refuses a file that isn't a Linkwell backup", async () => {
    const db = fakeDatabase(0);

    expect(await restoreBackup(db, { hello: "world" })).toMatch(/isn't a Linkwell backup/);
    expect(await restoreBackup(db, { ...backup, tables: { user: [] } })).toMatch(/no "account" table/);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
