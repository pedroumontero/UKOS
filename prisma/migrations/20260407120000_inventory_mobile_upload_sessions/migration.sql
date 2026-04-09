-- CreateTable
CREATE TABLE "inventory_mobile_upload_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_mobile_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_mobile_upload_sessions_token_key" ON "inventory_mobile_upload_sessions"("token");

-- CreateIndex
CREATE INDEX "inventory_mobile_upload_sessions_unitId_idx" ON "inventory_mobile_upload_sessions"("unitId");

-- CreateIndex
CREATE INDEX "inventory_mobile_upload_sessions_expiresAt_idx" ON "inventory_mobile_upload_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "inventory_mobile_upload_sessions" ADD CONSTRAINT "inventory_mobile_upload_sessions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_mobile_upload_sessions" ADD CONSTRAINT "inventory_mobile_upload_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_mobile_upload_sessions" ADD CONSTRAINT "inventory_mobile_upload_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
