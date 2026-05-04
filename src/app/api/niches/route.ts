export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.niche.count();
    
    // Auto-seed full niche list if empty
    if (count === 0) {
      // Trigger the seed endpoint internally by importing the seed data inline
      const defaultNiches = [
        { slug: 'iptv', displayName: 'IPTV & Streaming', keywords: ['iptv', 'streaming', 'stream', 'livetv', 'tvbox', 'channels', 'playlist', 'm3u', 'kodi', 'firestick', 'androidtv', 'smarttv', 'mediaplayer', 'tvplayer', 'streambox', 'cordcutting', 'iptvfr', 'iptvde', 'iptvnl', 'iptvuk'], targetTlds: ['.com', '.net', '.io', '.tv', '.fr', '.de', '.nl'] },
        { slug: 'artificial_intelligence', displayName: 'Artificial Intelligence', keywords: ['ai', 'aitools', 'artificialintelligence', 'machinelearning', 'chatgpt', 'llm', 'neural', 'deeplearning', 'aiwriting', 'aichat', 'aiagent', 'gpt', 'openai', 'copilot'], targetTlds: ['.com', '.io', '.ai', '.net', '.co'] },
        { slug: 'digital_marketing', displayName: 'Digital Marketing', keywords: ['seo', 'marketing', 'digitalmarketing', 'contentmarketing', 'socialmedia', 'emailmarketing', 'ppc', 'sem', 'analytics', 'affiliate', 'backlink', 'keyword'], targetTlds: ['.com', '.io', '.net', '.co'] },
        { slug: 'finance', displayName: 'Finance & Investing', keywords: ['finance', 'investing', 'crypto', 'trading', 'fintech', 'budget', 'money', 'wealth', 'stock', 'forex', 'bitcoin', 'cryptocurrency', 'defi', 'banking', 'loan', 'credit'], targetTlds: ['.com', '.io', '.net', '.co'] },
        { slug: 'health_wellness', displayName: 'Health & Wellness', keywords: ['health', 'wellness', 'fitness', 'nutrition', 'diet', 'yoga', 'meditation', 'supplement', 'vitamin', 'weightloss', 'keto', 'workout', 'gym', 'organic'], targetTlds: ['.com', '.net', '.io'] },
        { slug: 'saas_software', displayName: 'SaaS & Software', keywords: ['saas', 'software', 'tools', 'app', 'crm', 'automation', 'productivity', 'devtools', 'api', 'cloud', 'hosting'], targetTlds: ['.com', '.io', '.net', '.co'] },
        { slug: 'ecommerce', displayName: 'E-Commerce & Shopping', keywords: ['ecommerce', 'shop', 'store', 'buy', 'deal', 'discount', 'coupon', 'shopping', 'retail', 'dropshipping', 'shopify'], targetTlds: ['.com', '.net', '.io'] },
        { slug: 'cybersecurity', displayName: 'Cybersecurity', keywords: ['security', 'cyber', 'vpn', 'antivirus', 'password', 'encryption', 'firewall', 'hacking', 'privacy', 'malware', 'phishing'], targetTlds: ['.com', '.io', '.net'] },
        { slug: 'education', displayName: 'Education & Online Courses', keywords: ['education', 'learn', 'course', 'tutorial', 'training', 'academy', 'school', 'study', 'bootcamp', 'coding', 'programming'], targetTlds: ['.com', '.io', '.net'] },
        { slug: 'travel', displayName: 'Travel & Tourism', keywords: ['travel', 'hotel', 'flight', 'vacation', 'booking', 'tourism', 'resort', 'hostel', 'destination'], targetTlds: ['.com', '.net', '.io'] },
        { slug: 'crypto', displayName: 'Crypto & Web3', keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'defi', 'web3', 'token', 'wallet', 'mining'], targetTlds: ['.com', '.io', '.net'] },
        { slug: 'make_money_online', displayName: 'Make Money Online', keywords: ['makemoney', 'passiveincome', 'sidehustle', 'freelance', 'entrepreneur', 'onlinebusiness', 'income', 'profit'], targetTlds: ['.com', '.net', '.io'] },
        { slug: 'developer_tools', displayName: 'Developer Tools', keywords: ['developer', 'devtools', 'github', 'code', 'programming', 'ide', 'docker', 'devops', 'api', 'framework'], targetTlds: ['.com', '.io', '.dev'] },
        { slug: 'gambling_casinos', displayName: 'Gambling & Casinos', keywords: ['casino', 'gambling', 'poker', 'betting', 'slots', 'sportsbetting', 'blackjack', 'roulette'], targetTlds: ['.com', '.net', '.io'] },
        { slug: 'mental_health', displayName: 'Mental Health & Therapy', keywords: ['mentalhealth', 'therapy', 'anxiety', 'depression', 'counseling', 'psychologist', 'mindfulness', 'stress'], targetTlds: ['.com', '.net', '.io'] },
      ];
      
      for (const niche of defaultNiches) {
        await prisma.niche.create({
          data: {
            slug: niche.slug,
            displayName: niche.displayName,
            keywords: niche.keywords,
            targetTlds: niche.targetTlds,
            active: true,
          },
        });
      }
    }

    const niches = await prisma.niche.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ data: niches });
  } catch (error) {
    console.error("Failed to fetch niches:", error);
    return NextResponse.json({ error: "Failed to fetch niches", data: [] }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    console.log("Activating all niches via API route...");
    const result = await prisma.niche.updateMany({
      data: { active: true }
    });
    console.log("Activate all niches result:", result);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to activate all niches in API route:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
