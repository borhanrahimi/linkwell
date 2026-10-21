import { connection } from "next/server";
import { isDatabaseUp } from "@/lib/data";

// For an uptime monitor: it opens /api/health every few minutes and emails you
// when the answer isn't 200. "ok" means the app runs and reaches the database.
// It says nothing more (no versions, no error details), since anyone can open it.
export async function GET() {
  // Answer fresh every time, never from a cache.
  await connection();
  const ok = await isDatabaseUp();
  return Response.json(
    { status: ok ? "ok" : "down" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
