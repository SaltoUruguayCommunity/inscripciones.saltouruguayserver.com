import { client } from "../db";
import { UsersTable } from "../db/schema";
import { sql } from "drizzle-orm";

export async function getBearerUser(authorization: string) {
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) return null;
  const issuer = import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com";
  // The issuer verifies signature, expiration and revocation.
  const response = await fetch(new URL("/oauth/userinfo", issuer), {
    headers: { Authorization: "Bearer " + match[1] },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 500) throw new Error("OAuth service unavailable");
  if (!response.ok) return null;
  const profile = await response.json();
  const susId = Number(profile.sub);
  if (!Number.isSafeInteger(susId) || susId <= 0 || typeof profile.username !== "string" || !profile.username) return null;
  const values = {
    susId, username: profile.username,
    displayName: profile.displayName || profile.username,
    avatar: profile.avatar || null,
    discordId: profile.discordId || null,
    discordUsername: profile.discordUsername || null,
    admin: profile.is_admin === true,
    ...(typeof profile.email === "string" ? { email: profile.email } : {}),
  };
  const user = await client.insert(UsersTable).values(values).onConflictDoUpdate({
    target: UsersTable.susId,
    set: { ...values, updatedAt: sql`(current_timestamp)` },
  }).returning().get();
  return {
    id: user.id, susId: user.susId, username: user.username,
    name: user.displayName, email: user.email, image: user.avatar,
    discordId: user.discordId, discordUsername: user.discordUsername,
    is_admin: Boolean(user.admin),
  };
}
