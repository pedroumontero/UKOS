import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/server/db";

export const authOptions: NextAuthOptions = {
  // AUTH_TRUST_HOST=true en Docker/Caddy: next-auth v4 no tipa `trustHost` en AuthOptions; la env la usa el runtime.
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            activeCompany: true,
          },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          activeCompanyId: user.activeCompanyId,
          activeCompanyName: user.activeCompany.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.activeCompanyId = user.activeCompanyId;
        token.activeCompanyName = user.activeCompanyName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as string;
        session.user.activeCompanyId = token.activeCompanyId as string;
        session.user.activeCompanyName = token.activeCompanyName as string;
      }

      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
