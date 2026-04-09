import NextAuth from "next-auth";

import { authOptions } from "@/server/auth-options";

/**
 * Acceso directo http://IP:puerto (sin Caddy): en desarrollo fijamos `x-forwarded-proto` real
 * para que NextAuth no asuma https sobre http.
 */
function withForwardedProto(req: Request): Request {
  if (process.env.NODE_ENV !== "development") {
    return req;
  }
  const headers = new Headers(req.headers);
  if (headers.get("x-forwarded-proto")) {
    return req;
  }
  const url = new URL(req.url);
  headers.set("x-forwarded-proto", url.protocol === "https:" ? "https" : "http");
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }
  return new Request(url, init);
}

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

/** Next.js 16 debe pasar `context` con `params`; si se exporta el handler a pelo, a veces no llega y NextAuth usa el path de Pages (`req.query` undefined). */
export function GET(req: Request, context: RouteContext) {
  return handler(withForwardedProto(req), context);
}

export function POST(req: Request, context: RouteContext) {
  return handler(withForwardedProto(req), context);
}
