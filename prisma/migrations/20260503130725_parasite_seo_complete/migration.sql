-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "anchorRelevanceRatio" DOUBLE PRECISION,
ADD COLUMN     "anchorScore" INTEGER,
ADD COLUMN     "dominantAnchorTopic" TEXT,
ADD COLUMN     "googleIndexScore" INTEGER,
ADD COLUMN     "googleIndexed" BOOLEAN,
ADD COLUMN     "googlePageCount" INTEGER,
ADD COLUMN     "historicalKeywords" JSONB,
ADD COLUMN     "parasiteReadiness" TEXT,
ADD COLUMN     "parasiteScore" INTEGER,
ADD COLUMN     "peakTrafficEstimate" INTEGER,
ADD COLUMN     "sampleIndexedUrls" TEXT[],
ADD COLUMN     "trafficScore" INTEGER;
