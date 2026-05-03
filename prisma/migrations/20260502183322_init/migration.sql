-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'SCORING', 'QUEUED', 'BOUGHT', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "dr" DOUBLE PRECISION,
    "da" DOUBLE PRECISION,
    "backlinks" INTEGER,
    "referringDomains" INTEGER,
    "waybackPages" INTEGER,
    "lastArchived" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "filterReason" TEXT,
    "source" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3),
    "boughtAt" TIMESTAMP(3),
    "price" DOUBLE PRECISION,
    "cloudflareZoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "keywords" TEXT[],
    "targetTlds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "domainsScanned" INTEGER NOT NULL DEFAULT 0,
    "domainsPassed" INTEGER NOT NULL DEFAULT 0,
    "domainsBought" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "log" JSONB[],
    "status" TEXT NOT NULL,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");
