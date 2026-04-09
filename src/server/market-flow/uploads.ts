import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { validateInventoryOptimizedBuffers } from "@/features/market-flow/inventory/upload-limits";

import { optimizeInventoryImage } from "@/server/market-flow/inventory-image-optimize";

function extensionFromFileName(name: string): string {
  if (!name.includes(".")) return "jpg";
  const ext = name.split(".").pop();
  return ext && /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : "jpg";
}

export async function saveProductPhotos(companyId: string, files: File[]) {
  if (!files.length) {
    return [];
  }

  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "market-flow", companyId);
  await mkdir(uploadDirectory, { recursive: true });

  type Prepared = { buffer: Buffer; extension: string; originalFileName: string };
  const prepared: Prepared[] = [];

  for (const file of files) {
    if (!file.size) {
      continue;
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeInventoryImage(raw);

    let buffer: Buffer;
    let extension: string;

    if (optimized) {
      buffer = optimized.buffer;
      extension = optimized.extension;
    } else {
      buffer = raw;
      extension = extensionFromFileName(file.name);
    }

    prepared.push({ buffer, extension, originalFileName: file.name });
  }

  const limitError = validateInventoryOptimizedBuffers(prepared.map((p) => p.buffer));
  if (limitError) {
    throw new Error(limitError);
  }

  const saved = [] as Array<{ fileUrl: string; fileName: string }>;

  for (const { buffer, extension, originalFileName } of prepared) {
    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDirectory, fileName);
    await writeFile(filePath, buffer);

    saved.push({
      fileUrl: `/uploads/market-flow/${companyId}/${fileName}`,
      fileName: originalFileName,
    });
  }

  return saved;
}
