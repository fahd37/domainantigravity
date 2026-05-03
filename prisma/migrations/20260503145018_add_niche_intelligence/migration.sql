-- CreateTable
CREATE TABLE "NicheIntelligence" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avgCompetitionScore" DOUBLE PRECISION NOT NULL,
    "avgDomainAge" DOUBLE PRECISION NOT NULL,
    "avgDR" DOUBLE PRECISION NOT NULL,
    "topResultsHaveExpired" BOOLEAN NOT NULL,
    "totalKeywords" INTEGER NOT NULL,
    "avgMonthlySearches" INTEGER NOT NULL,
    "topKeywordVolume" INTEGER NOT NULL,
    "topKeyword" TEXT NOT NULL,
    "avgCPC" DOUBLE PRECISION NOT NULL,
    "affiliateAvailable" BOOLEAN NOT NULL,
    "avgCommission" DOUBLE PRECISION NOT NULL,
    "estimatedRPM" DOUBLE PRECISION NOT NULL,
    "monthlyRevenuePerSite" DOUBLE PRECISION NOT NULL,
    "parasiteSuccessRate" DOUBLE PRECISION NOT NULL,
    "avgTimeToRank" INTEGER NOT NULL,
    "expiredDomainsAvailable" INTEGER NOT NULL,
    "indexationRate" DOUBLE PRECISION NOT NULL,
    "competitorCount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "opportunity" TEXT NOT NULL,
    "topKeywords" JSONB NOT NULL,
    "affiliatePrograms" JSONB NOT NULL,
    "lastAnalyzed" TIMESTAMP(3) NOT NULL,
    "dataSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NicheIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicheKeyword" (
    "id" TEXT NOT NULL,
    "nicheSlug" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "cpc" DOUBLE PRECISION NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "trend" TEXT NOT NULL,
    "parasiteReady" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NicheKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NicheIntelligence_slug_key" ON "NicheIntelligence"("slug");
