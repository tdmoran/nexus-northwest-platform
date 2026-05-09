import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyTOTP } from "@/lib/totp";
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

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email + password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "Authenticator code", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.organiserUser.findUnique({
          where: { email: credentials.email.toLowerCase().trim() }
        });
        if (!user || !user.active) return null;

        const ok = await argon2.verify(user.passwordHash, credentials.password);
        if (!ok) return null;

        if (user.mfaEnrolled) {
          if (!user.mfaSecret) {
            // Inconsistent state — refuse login until an admin re-enrolls.
            return null;
          }
          const code = (credentials.mfaCode ?? "").toString().trim();
          if (!code) throw new MfaRequiredError();
          if (!verifyTOTP(user.mfaSecret, code)) throw new MfaInvalidError();
        }

        await prisma.organiserUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
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
