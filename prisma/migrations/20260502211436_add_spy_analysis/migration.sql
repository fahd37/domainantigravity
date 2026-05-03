-- CreateTable
CREATE TABLE "SpyAnalysis" (
    "id" TEXT NOT NULL,
    "competitorInput" TEXT NOT NULL,
    "discoveredDomains" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "importedAsNiche" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpyAnalysis_pkey" PRIMARY KEY ("id")
);
