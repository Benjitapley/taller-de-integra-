import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { authConfig, cookieName, getSession } from "./gateway";

export async function currentSession() {
  const config = authConfig();
  const token = config ? (await cookies()).get(cookieName(config))?.value ?? "" : "";
  return getSession(config, token);
}

export async function canRenewSession() {
  const config = authConfig();
  if (config?.provider !== "supabase") return false;
  const name = config.secure ? "__Host-roomies_sb_refresh" : "roomies_sb_dev_refresh";
  return Boolean((await cookies()).get(name)?.value);
}

/** UI isolation only; authorization remains in each server operation. Never serialize the bearer. */
export async function privateScope() {
  const config = authConfig();
  const token = config ? (await cookies()).get(cookieName(config))?.value ?? "" : "";
  return createHash("sha256").update(token).digest("hex");
}
