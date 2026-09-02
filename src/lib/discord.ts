const SUS_URL = import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com";
const SUS_CLIENT_ID = import.meta.env.SUS_OAUTH_CLIENT_ID;
const SUS_CLIENT_SECRET = import.meta.env.SUS_OAUTH_CLIENT_SECRET;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${SUS_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SUS_CLIENT_ID!,
      client_secret: SUS_CLIENT_SECRET!,
      scope: "service:api",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to obtain service token");
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

export interface DiscordUserInfo {
  discordId: string | null;
  discordUsername: string | null;
}

export async function getUserDiscordInfo(userId: number): Promise<DiscordUserInfo> {
  const token = await getServiceToken();

  const res = await fetch(`${SUS_URL}/api/users/${userId}/discord`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch user Discord info");
  }

  return res.json();
}

export async function isDiscordMember(discordId: string): Promise<boolean> {
  const token = await getServiceToken();

  const res = await fetch(`${SUS_URL}/api/discord/is-member/${discordId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to check Discord membership");
  }

  const data = await res.json();
  return data.isMember === true;
}
