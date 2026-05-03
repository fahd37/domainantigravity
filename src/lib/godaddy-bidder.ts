export interface BidResult {
  success: boolean;
  newBid?: number;
  outbid?: boolean;
  error?: string;
}

export interface AuctionStatus {
  listingId: string;
  currentPrice: number;
  hoursRemaining: number;
  bidCount: number;
}

export async function placeBid(
  listingId: string,
  bidAmount: number,
  apiKey: string,
  apiSecret: string
): Promise<BidResult> {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/auctions/${listingId}/bids`, {
      method: "POST",
      headers: {
        Authorization: `sso-key ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ amount: bidAmount }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return {
        success: true,
        newBid: data.amount ?? bidAmount,
      };
    }

    // Outbid response
    if (res.status === 409 || data?.code === "OUTBID" || data?.message?.toLowerCase().includes("outbid")) {
      return { success: false, outbid: true, error: data?.message || "Outbid" };
    }

    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Get current auction status
async function getAuctionStatus(
  listingId: string,
  apiKey: string,
  apiSecret: string
): Promise<AuctionStatus | null> {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/auctions/${listingId}`, {
      headers: {
        Authorization: `sso-key ${apiKey}:${apiSecret}`,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const endTime = data.endTime || data.expiresAt || "";
    const hoursRemaining = endTime
      ? Math.max(0, (new Date(endTime).getTime() - Date.now()) / 3600000)
      : 999;
    return {
      listingId,
      currentPrice: data.currentBid ?? data.price ?? 0,
      hoursRemaining,
      bidCount: data.bidCount ?? 0,
    };
  } catch {
    return null;
  }
}

// Sniper bidder: polls every 10 minutes, bids in final 2 hours
export async function watchAuction(
  listingId: string,
  maxBid: number,
  apiKey: string,
  apiSecret: string
): Promise<BidResult> {
  const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const MAX_POLLS = 30; // max 5 hours of watching

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    const status = await getAuctionStatus(listingId, apiKey, apiSecret);
    if (!status) return { success: false, error: "Could not fetch auction status" };

    // Auction ended
    if (status.hoursRemaining <= 0) {
      return { success: false, error: "Auction already ended" };
    }

    // Sniper window: within 2 hours AND we can still afford it
    if (status.hoursRemaining < 2 && status.currentPrice < maxBid) {
      const bidAmount = status.currentPrice + 1;
      console.log(`[Sniper] ${listingId} — placing bid $${bidAmount} with ${status.hoursRemaining.toFixed(1)}h remaining`);
      return await placeBid(listingId, bidAmount, apiKey, apiSecret);
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  return { success: false, error: "Max polls reached without entering sniper window" };
}
