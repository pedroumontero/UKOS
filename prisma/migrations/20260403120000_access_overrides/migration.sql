-- CreateEnum
CREATE TYPE "AccessOverrideEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "CompanyUserAccessOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "effect" "AccessOverrideEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUserAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUserAccessOverride_userId_companyId_accessKey_key" ON "CompanyUserAccessOverride"("userId", "companyId", "accessKey");

-- CreateIndex
CREATE INDEX "CompanyUserAccessOverride_companyId_idx" ON "CompanyUserAccessOverride"("companyId");

-- CreateIndex
CREATE INDEX "CompanyUserAccessOverride_userId_idx" ON "CompanyUserAccessOverride"("userId");

-- AddForeignKey
ALTER TABLE "CompanyUserAccessOverride" ADD CONSTRAINT "CompanyUserAccessOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyUserAccessOverride" ADD CONSTRAINT "CompanyUserAccessOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
