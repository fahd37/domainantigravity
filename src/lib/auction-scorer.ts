export interface AuctionOpportunity {
  opportunityScore: number;
  maxBid: number;
  reason: string;
}

export interface AuctionInput {
  currentBid: number;
  bidCount: number;
  hoursRemaining: number;
}

export function scoreAuctionOpportunity(
  auction: AuctionInput,
  domainScore: number,
  maxPrice = 50
): AuctionOpportunity {
  let score = domainScore;
  const reasons: string[] = [];

  // Competition bonus
  if (auction.bidCount === 0) {
    score += 20;
    reasons.push("No competition (+20)");
  } else if (auction.bidCount <= 2) {
    score += 10;
    reasons.push("Low competition (+10)");
  }

  // Urgency bonuses/penalties
  if (auction.hoursRemaining < 2) {
    score -= 10;
    reasons.push("Too risky — ends <2h (-10)");
  } else if (auction.hoursRemaining < 6) {
    score += 15;
    reasons.push("Ending soon <6h (+15)");
  }

  // Price signal
  if (auction.currentBid < 20) {
    score += 15;
    reasons.push("Underpriced <$20 (+15)");
  }

  const maxBid = Math.min(maxPrice, auction.currentBid * 2.5);

  // Already too expensive
  if (maxBid < auction.currentBid + 1) {
    return {
      opportunityScore: 0,
      maxBid,
      reason: `Already at max budget (current: $${auction.currentBid}, limit: $${maxPrice})`,
    };
  }

  return {
    opportunityScore: Math.min(100, Math.max(0, score)),
    maxBid,
    reason: reasons.join(" · ") || "Standard opportunity",
  };
}
