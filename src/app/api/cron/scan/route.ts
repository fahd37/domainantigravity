export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cron: runs every 6 hours — multi-source domain scan
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  downloadWhoisDSDrops,
  scrapeExpiredDomainsReliable,
  scrapeNamecheapMarket,
  scrapeDomainDB
} from "@/lib/sources/whoisds";
import { scrapeGoDaddyAuctions } from "@/lib/sources/godaddy-auctions";
import { IPTV_DOMAIN_PATTERNS } from "@/lib/iptv/keyword-database";

export async function GET(request: Request) {
  const isDev = process.env.NODE_ENV === 'development';
  const secret = request.headers.get('x-cron-secret');
  if (!isDev && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const log: string[] = [];

  try {
    // Load active niches + keywords
    const niches = await prisma.niche.findMany({ where: { active: true } });
    const allKeywords = niches.flatMap(n => n.keywords);
    allKeywords.push(...IPTV_DOMAIN_PATTERNS);
    const uniqueKeywords = Array.from(new Set(allKeywords));

    log.push(`Loaded ${niches.length} active niches, ${uniqueKeywords.length} unique keywords (including IPTV patterns)`);
    log.push('Starting multi-source domain scan...');

    // ── SOURCE 1: WhoisDS (primary bulk feed) ──────────────────────────────
    log.push('Source 1: WhoisDS bulk file...');
    const whoisDomains = await downloadWhoisDSDrops(uniqueKeywords);
    const whoisWasSuccessful = whoisDomains.some(d => d.source === 'whoisds');
    log.push(`WhoisDS: ${whoisDomains.filter(d => d.source === 'whoisds').length} domains (${whoisWasSuccessful ? 'SUCCESS' : 'FAILED — fallbacks ran'})`);

    let expiredCount = 0;
    let namecheapCount = 0;
    let domaindbCount = 0;
    const extraDomains: Array<{domain: string; source: string; matchedKeyword: string}> = [];

    if (!whoisWasSuccessful) {
      // ── SOURCE 2: ExpiredDomains.net ──────────────────────────────────────
      log.push('Source 2: ExpiredDomains.net...');
      const expiredResults = await scrapeExpiredDomainsReliable(uniqueKeywords.slice(0, 10));
      expiredCount = expiredResults.length;
      extraDomains.push(...expiredResults);
      log.push(`ExpiredDomains: ${expiredCount} domains found`);

      // ── SOURCE 3: Namecheap Marketplace ───────────────────────────────────
      log.push('Source 3: Namecheap Marketplace...');
      const namecheapResults = await scrapeNamecheapMarket(uniqueKeywords.slice(0, 5));
      namecheapCount = namecheapResults.length;
      extraDomains.push(...namecheapResults);
      log.push(`Namecheap Market: ${namecheapCount} domains found`);

      // ── SOURCE 4: DomainDB ─────────────────────────────────────────────────
      log.push('Source 4: DomainDB...');
      const domaindbResults = await scrapeDomainDB(uniqueKeywords.slice(0, 5));
      domaindbCount = domaindbResults.length;
      extraDomains.push(...domaindbResults);
      log.push(`DomainDB: ${domaindbCount} domains found`);
    }

    // ── SOURCE 5: GoDaddy Auctions (always runs — separate table) ─────────
    log.push('Source 5: GoDaddy Auctions...');
    let auctionCount = 0;
    for (const niche of niches) {
      for (const keyword of niche.keywords.slice(0, 2)) {
        try {
          const auctions = await scrapeGoDaddyAuctions([keyword]);
          auctionCount += auctions.length;
          for (const auction of auctions) {
            await prisma.auctionWatch.upsert({
              where: { listingId: auction.listingId },
              update: { currentBid: auction.currentBid, bidCount: auction.bidCount },
              create: {
                domain: auction.domain,
                listingId: auction.listingId,
                currentBid: auction.currentBid,
                maxBid: 0,
                bidCount: auction.bidCount,
                hoursRemaining: auction.hoursRemaining,
                opportunityScore: 0,
                status: 'WATCHING'
              }
            });
          }
        } catch (e) {
          log.push(`GoDaddy failed for ${keyword}: ${e}`);
        }
      }
    }
    log.push(`GoDaddy Auctions: ${auctionCount} found`);

    // ── MERGE + DEDUPLICATE ─────────────────────────────────────────────────
    const allFound = [
      ...whoisDomains.map(d => ({ domain: d.domain, source: d.source })),
      ...extraDomains
    ];
    const seenDomains = new Set<string>();
    const unique: string[] = [];
    for (const d of allFound) {
      if (!seenDomains.has(d.domain)) {
        seenDomains.add(d.domain);
        unique.push(d.domain);
      }
    }

    log.push(`Total unique domains after dedup: ${unique.length}`);

    // ── SAVE TO DB ──────────────────────────────────────────────────────────
    let saved = 0;
    for (const domain of unique) {
      try {
        const exists = await prisma.domain.findFirst({ where: { name: domain } });
        if (!exists) {
          await prisma.domain.create({
            data: {
              name: domain,
              tld: '.' + domain.split('.').pop(),
              status: 'PENDING',
              source: 'multi-source',
              niche: 'unknown',
              score: 0
            }
          });
          saved++;
        }
      } catch { continue; }
    }
    log.push(`Saved ${saved} new domains to DB`);

    // ── LOG SCAN RUN ────────────────────────────────────────────────────────
    await prisma.scanRun.create({
      data: {
        startedAt,
        endedAt: new Date(),
        source: 'whoisds+expired+namecheap+domaindb+godaddy',
        domainsScanned: unique.length,
        domainsPassed: saved,
        domainsBought: 0,
        totalSpent: 0,
        status: 'COMPLETED',
        log: log as any
      }
    });

    return NextResponse.json({
      success: true,
      domainsFound: unique.length,
      domainsSaved: saved,
      sources: {
        whoisds: whoisDomains.filter(d => d.source === 'whoisds').length,
        expiredDomains: expiredCount,
        namecheapMarket: namecheapCount,
        domainDB: domaindbCount,
        godaddyAuctions: auctionCount
      },
      log
    });

  } catch (error) {
    log.push(`FATAL ERROR: ${error}`);
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 });
  }
}
