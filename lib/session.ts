import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// The id of the signed-in user. Throws when nobody is signed in, so a Server
// Action called without a session stops before it touches any data.
export async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Not signed in");
  }
  return session.user.id;
}
