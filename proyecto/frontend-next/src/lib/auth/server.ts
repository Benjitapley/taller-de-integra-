import "server-only";
import { cookies } from "next/headers";
import { authConfig, cookieName, getSession } from "./gateway";

export async function currentSession() {
  const config = authConfig();
  const token = config ? (await cookies()).get(cookieName(config))?.value ?? "" : "";
  return getSession(config, token);
}
