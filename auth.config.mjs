import { defineConfig } from "auth-astro";
import { eq, sql } from "drizzle-orm";
import { client } from "./src/db";
import { UsersTable } from "./src/db/schema";

export default defineConfig({
  providers: [
    {
      id: "saltouruguay",
      name: "SaltoUruguayServer",
      type: "oauth",
      authorization: {
        url: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/authorize`,
        params: { scope: "openid profile email", response_type: "code" },
      },
      token: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/token`,
      userinfo: {
        url: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/userinfo`,
      },
      clientId: import.meta.env.SUS_OAUTH_CLIENT_ID,
      clientSecret: import.meta.env.SUS_OAUTH_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.displayName || profile.username,
          email: profile.email,
          image: profile.avatar,
          username: profile.username,
          discordId: profile.discordId,
          discordUsername: profile.discordUsername,
        };
      },
    },
  ],
  callbacks: {
    jwt: async ({ token, account, profile }) => {
      if (account && profile) {
        const susId = Number(profile.sub);

        const existingUser = await client
          .select()
          .from(UsersTable)
          .where(eq(UsersTable.susId, susId))
          .get();

        if (existingUser) {
          await client
            .update(UsersTable)
            .set({
              displayName: profile.displayName || profile.name,
              username: profile.username,
              avatar: profile.picture || profile.avatar,
              email: profile.email,
              discordId: profile.discordId || null,
              discordUsername: profile.discordUsername || null,
              admin: Boolean(profile.is_admin),
              updatedAt: sql`(current_timestamp)`,
            })
            .where(eq(UsersTable.id, existingUser.id))
            .run();

          token.userId = existingUser.id;
          token.is_admin = Boolean(profile.is_admin);
        } else {
          const result = await client
            .insert(UsersTable)
            .values({
              susId,
              displayName: profile.displayName || profile.name,
              username: profile.username,
              avatar: profile.picture || profile.avatar,
              email: profile.email,
              discordId: profile.discordId || null,
              discordUsername: profile.discordUsername || null,
              admin: Boolean(profile.is_admin),
            })
            .returning()
            .get();

          token.userId = result.id;
          token.is_admin = Boolean(profile.is_admin);
        }
      }
      return token;
    },

    session: async ({ session, token }) => {
      if (token.userId) {
        const user = await client
          .select()
          .from(UsersTable)
          .where(eq(UsersTable.id, token.userId))
          .get();

        if (user) {
          session.user = {
            ...session.user,
            id: user.id,
            susId: user.susId,
            username: user.username,
            discordId: user.discordId,
            discordUsername: user.discordUsername,
            is_admin: Boolean(user.admin),
          };
        }
      }
      return session;
    },
  },
});
