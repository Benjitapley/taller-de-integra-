import "server-only";
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
