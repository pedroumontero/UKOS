import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { getValidMobileUploadSessionByToken } from "@/server/market-flow/inventory-mobile-session";
import { persistInventoryPhotosFromMobileUpload } from "@/server/market-flow/inventory-mobile-upload-persist";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** Subidas móviles lentas (red móvil + varias fotos secuenciales). */
export const maxDuration = 300;

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
  }

  const session = await getValidMobileUploadSessionByToken(token);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Enlace inválido o vencido." }, { status: 404 });
  }

  const unit = await db.productUnit.findFirst({
    where: { id: session.unitId, companyId: session.companyId },
    select: { title: true, number: true },
  });

  if (!unit) {
    return NextResponse.json({ ok: false, error: "Unidad no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true as const,
    title: unit.title,
    number: unit.number,
    expiresAt: session.expiresAt.toISOString(),
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
  }

  const session = await getValidMobileUploadSessionByToken(token);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Enlace inválido o vencido." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const result = await persistInventoryPhotosFromMobileUpload({
    companyId: session.companyId,
    unitId: session.unitId,
    actorUserId: session.userId,
    files,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true as const, added: result.added });
}
