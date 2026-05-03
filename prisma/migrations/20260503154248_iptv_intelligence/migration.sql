-- CreateTable
CREATE TABLE "IPTVDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetMarket" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "marketScore" DOUBLE PRECISION NOT NULL,
    "iptvKeywordMatch" TEXT[],
    "iptvKeywordStrength" DOUBLE PRECISION NOT NULL,
    "previouslyIPTV" BOOLEAN NOT NULL,
    "previousContent" TEXT,
    "channelCount" INTEGER,
    "googleIndexed" BOOLEAN NOT NULL,
    "googlePageCount" INTEGER NOT NULL,
    "domainAge" INTEGER NOT NULL,
    "referringDomains" INTEGER NOT NULL,
    "trustFlow" DOUBLE PRECISION NOT NULL,
    "citationFlow" DOUBLE PRECISION NOT NULL,
    "tfCfRatio" DOUBLE PRECISION NOT NULL,
    "estimatedMonthly" DOUBLE PRECISION NOT NULL,
    "affiliateMatch" TEXT[],
    "cpcValue" DOUBLE PRECISION NOT NULL,
    "topCompetitorDomains" TEXT[],
    "rankingGap" TEXT NOT NULL,
    "languageAnalysis" JSONB NOT NULL,
    "iptvScore" DOUBLE PRECISION NOT NULL,
    "parasiteReadiness" TEXT NOT NULL,
    "estimatedRankDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recommendation" TEXT,
    "rejectionReason" TEXT,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "boughtAt" TIMESTAMP(3),
    "deployedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPTVDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPTVKeywordDatabase" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "cpc" DOUBLE PRECISION NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "trend" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isMoneyKw" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPTVKeywordDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPTVMarketAnalysis" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "totalKeywords" INTEGER NOT NULL,
    "avgCPC" DOUBLE PRECISION NOT NULL,
    "topKeyword" TEXT NOT NULL,
    "topKeywordVol" INTEGER NOT NULL,
    "competitorCount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "opportunity" TEXT NOT NULL,
    "expiredAvailable" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "avgDaysToRank" INTEGER NOT NULL,
    "estimatedRPM" DOUBLE PRECISION NOT NULL,
    "topTLDs" TEXT[],
    "topKeywords" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPTVMarketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IPTVDomain_domain_key" ON "IPTVDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "IPTVMarketAnalysis_market_key" ON "IPTVMarketAnalysis"("market");
