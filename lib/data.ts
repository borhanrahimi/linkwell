import "server-only";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { links } from "@/db/schema";
import { toLink } from "@/lib/links";
import type { Link } from "@/types/link";

export async function getLinks(): Promise<Link[]> {
  await connection();
  const rows = await db.select().from(links).orderBy(desc(links.createdAt));
  return rows.map(toLink);
}
