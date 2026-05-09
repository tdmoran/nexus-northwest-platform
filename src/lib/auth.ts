import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";

// Provider isn't a top-level next-auth export — derive the type from
// NextAuthOptions["providers"] so it stays portable across SDK versions.
type Provider = NextAuthOptions["providers"][number];
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyTOTP } from "@/lib/totp";
import { consumeMagicLink } from "@/server/magic-link";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import type { OrganiserRole } from "@prisma/client";

export class MfaRequiredError extends Error {
  constructor() {
    super("MFA_REQUIRED");
    this.name = "MfaRequiredError";
  }
}

export class MfaInvalidError extends Error {
  constructor() {
    super("MFA_INVALID");
    this.name = "MfaInvalidError";
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: OrganiserRole;
    };
  }
  interface User {
    id: string;
    role: OrganiserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: OrganiserRole;
  }
}

const credentials = CredentialsProvider({
  name: "Email + password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
    mfaCode: { label: "Authenticator code", type: "text" },
    magicToken: { label: "Magic link token", type: "text" }
  },
  async authorize(credentials) {
    // Magic-link path: present a single-use signed token instead of password.
    if (credentials?.magicToken) {
      const result = await consumeMagicLink(credentials.magicToken);
      if (!result) return null;
      const user = await prisma.organiserUser.findUnique({ where: { id: result.organiserUserId } });
      if (!user || !user.active) return null;
      // Magic-link sign-in does not require MFA — the email channel is the second factor.
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    }

    if (!credentials?.email || !credentials?.password) return null;

    const user = await prisma.organiserUser.findUnique({
      where: { email: credentials.email.toLowerCase().trim() }
    });
    if (!user || !user.active) return null;

    const ok = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!ok) return null;

    if (user.mfaEnrolled) {
      if (!user.mfaSecret) return null;
      const code = (credentials.mfaCode ?? "").toString().trim();
      if (!code) throw new MfaRequiredError();
      if (!verifyTOTP(user.mfaSecret, code)) throw new MfaInvalidError();
    }

    await prisma.organiserUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
});

const providers: Provider[] = [credentials];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } }
    })
  );
}

if (env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET) {
  providers.push(
    AzureADProvider({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      tenantId: env.AZURE_AD_TENANT_ID || "common"
    })
  );
}

export const ssoEnabled = {
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  azure: Boolean(env.AZURE_AD_CLIENT_ID && env.AZURE_AD_CLIENT_SECRET)
};

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers,
  callbacks: {
    // Invite-only: SSO sign-in is permitted only when an active OrganiserUser
    // already exists for the email. This prevents a public OAuth login from
    // creating an organiser account by accident.
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;

      const email = (profile?.email ?? user.email ?? "").toLowerCase().trim();
      if (!email) {
        log.warn("sso.signin.no_email", { provider: account?.provider });
        return "/login?error=sso_no_email";
      }
      const record = await prisma.organiserUser.findUnique({ where: { email } });
      if (!record) {
        log.warn("sso.signin.unknown_user", { email, provider: account?.provider });
        return "/login?error=sso_not_invited";
      }
      if (!record.active) {
        log.warn("sso.signin.disabled_user", { email, provider: account?.provider });
        return "/login?error=sso_disabled";
      }

      // Mutate the user object so the jwt callback persists the right id/role.
      user.id = record.id;
      user.role = record.role;
      user.name = record.name;
      user.email = record.email;

      await prisma.organiserUser.update({
        where: { id: record.id },
        data: { lastLoginAt: new Date() }
      });
      await audit({
        action: "auth.sso.signin",
        actorId: record.id,
        meta: { provider: account?.provider }
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  }
};
