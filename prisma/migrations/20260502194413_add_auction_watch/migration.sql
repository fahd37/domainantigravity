-- CreateEnum
CREATE TYPE "AuctionWatchStatus" AS ENUM ('WATCHING', 'WON', 'LOST', 'OUTBID', 'EXPIRED');

-- CreateTable
CREATE TABLE "AuctionWatch" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "currentBid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxBid" DOUBLE PRECISION NOT NULL,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "hoursRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AuctionWatchStatus" NOT NULL DEFAULT 'WATCHING',
    "placedBidAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "finalPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionWatch_listingId_key" ON "AuctionWatch"("listingId");
