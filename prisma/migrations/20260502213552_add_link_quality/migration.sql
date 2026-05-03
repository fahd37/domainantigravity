-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "aliveRatio" DOUBLE PRECISION,
ADD COLUMN     "geoDistribution" INTEGER,
ADD COLUMN     "indexedRatio" DOUBLE PRECISION,
ADD COLUMN     "linkQualityScore" INTEGER,
ADD COLUMN     "linkVelocityRisk" BOOLEAN,
ADD COLUMN     "linkVerdict" TEXT,
ADD COLUMN     "relevanceRatio" DOUBLE PRECISION;
