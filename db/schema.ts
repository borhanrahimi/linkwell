import { integer, pgTable, primaryKey, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color"), // one of FOLDER_COLORS; null = gray (folders made before v1.6)
  icon: text("icon"), // one of FOLDER_ICONS; null = a coloured dot
  // The folder this one is inside; null = a top-level folder. A foreign key
  // to its own table (AnyPgColumn: TypeScript needs help with that).
  parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "set null" }),
  // The folder this one was inside when that folder went to the Trash (it
  // moved up a level then), so restoring that folder can put it back.
  cameFromFolderId: uuid("came_from_folder_id").references((): AnyPgColumn => folders.id, { onDelete: "set null" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // In the Trash since then; null = not deleted. Gone for good after 30 days.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Pinned to Home since then (shown first there); null = not pinned.
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
});

export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  tags: text("tags").array().notNull().default([]),
  // "Why I saved this": optional, written in the Edit form.
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status", { enum: ["ok", "broken"] }),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  // The page's sharing picture (og:image), shown on its card: an https
  // address, "" when the page has none, null when not looked for yet.
  image: text("image"),
  folderId: uuid("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  // The folder this link was in when that folder went to the Trash, so
  // restoring the folder can put it back. Cleared when the link is moved.
  cameFromFolderId: uuid("came_from_folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type LinkRow = typeof links.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export * from "./auth-schema";

// Rate limits (lib/limits.ts): how often each user used each limited action in
// one time window. One row per user, action and window; old rows are deleted
// by the daily cron job.
export const rateLimits = pgTable(
  "rate_limits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.action, table.windowStart] })]
);
