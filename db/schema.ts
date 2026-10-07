import { check } from "drizzle-orm/gel-core";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status", {enum: ["ok", "broken"]}),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
});

export type LinkRow = typeof links.$inferSelect;
