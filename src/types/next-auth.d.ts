import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      activeCompanyId: string;
      activeCompanyName: string;
    };
  }

  interface User {
    role: string;
    activeCompanyId: string;
    activeCompanyName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    activeCompanyId?: string;
    activeCompanyName?: string;
  }
}
