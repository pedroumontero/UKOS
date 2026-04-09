import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function mimeFromFileName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (segments.some((s) => s.includes("..") || s === "")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const absolute = path.join(UPLOAD_ROOT, ...segments);
  const normalizedRoot = path.normalize(UPLOAD_ROOT + path.sep);
  const normalizedFile = path.normalize(absolute);
  if (!normalizedFile.startsWith(normalizedRoot)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const buf = await readFile(normalizedFile);
    const fileName = segments[segments.length - 1] ?? "file";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeFromFileName(fileName),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
