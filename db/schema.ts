import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status", { enum: ["ok", "broken"] }),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export type LinkRow = typeof links.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export * from "./auth-schema";
