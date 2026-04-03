import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveProductPhotos(companyId: string, files: File[]) {
  if (!files.length) {
    return [];
  }

  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "market-flow", companyId);
  await mkdir(uploadDirectory, { recursive: true });

  const saved = [] as Array<{ fileUrl: string; fileName: string }>;

  for (const file of files) {
    if (!file.size) {
      continue;
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const fileName = `${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDirectory, fileName);
    const arrayBuffer = await file.arrayBuffer();

    await writeFile(filePath, Buffer.from(arrayBuffer));

    saved.push({
      fileUrl: `/uploads/market-flow/${companyId}/${fileName}`,
      fileName: file.name,
    });
  }

  return saved;
}
