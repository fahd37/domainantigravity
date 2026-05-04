export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALL_NICHES = [
  {
    slug: 'iptv',
    displayName: 'IPTV & Streaming',
    keywords: ['iptv', 'streaming', 'stream', 'livetv', 'livetv', 'tvbox', 'tvbox', 'channels', 'playlist', 'm3u', 'kodi', 'firestick', 'androidtv', 'smarttv', 'mediaplayer', 'tvplayer', 'streambox', 'cordcutting', 'meilleuriptv', 'bestesiptv', 'besteiptv', 'iptvfr', 'iptvde', 'iptvnl', 'iptvuk', 'chaines', 'fernsehen', 'kanaler', 'zenders'],
    targetTlds: ['.com', '.net', '.io', '.tv', '.fr', '.de', '.nl', '.se', '.no', '.dk']
  },
  {
    slug: 'artificial_intelligence',
    displayName: 'Artificial Intelligence',
    keywords: ['ai', 'aitools', 'artificialintelligence', 'machinelearning', 'chatgpt', 'llm', 'neural', 'deeplearning', 'aiwriting', 'aichat', 'aiagent', 'gpt', 'openai', 'copilot'],
    targetTlds: ['.com', '.io', '.ai', '.net', '.co']
  },
  {
    slug: 'digital_marketing',
    displayName: 'Digital Marketing',
    keywords: ['seo', 'marketing', 'digitalmarketing', 'contentmarketing', 'socialmedia', 'emailmarketing', 'ppc', 'sem', 'analytics', 'adwords', 'affiliate', 'backlink', 'keyword'],
    targetTlds: ['.com', '.io', '.net', '.co']
  },
  {
    slug: 'finance',
    displayName: 'Finance & Investing',
    keywords: ['finance', 'investing', 'crypto', 'trading', 'fintech', 'budget', 'money', 'wealth', 'stock', 'forex', 'bitcoin', 'cryptocurrency', 'defi', 'banking', 'loan', 'credit'],
    targetTlds: ['.com', '.io', '.net', '.co']
  },
  {
    slug: 'health_wellness',
    displayName: 'Health & Wellness',
    keywords: ['health', 'wellness', 'fitness', 'nutrition', 'diet', 'yoga', 'meditation', 'healthcoach', 'supplement', 'vitamin', 'weightloss', 'keto', 'workout', 'gym', 'organic'],
    targetTlds: ['.com', '.net', '.io', '.de', '.fr']
  },
  {
    slug: 'saas_software',
    displayName: 'SaaS & Software',
    keywords: ['saas', 'software', 'tools', 'app', 'crm', 'erp', 'automation', 'productivity', 'devtools', 'api', 'cloud', 'hosting'],
    targetTlds: ['.com', '.io', '.net', '.co']
  },
  {
    slug: 'ecommerce',
    displayName: 'E-Commerce & Shopping',
    keywords: ['ecommerce', 'shop', 'store', 'buy', 'deal', 'discount', 'coupon', 'shopping', 'retail', 'dropshipping', 'amazon', 'shopify'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'cybersecurity',
    displayName: 'Cybersecurity',
    keywords: ['security', 'cyber', 'vpn', 'antivirus', 'password', 'encryption', 'firewall', 'hacking', 'privacy', 'malware', 'phishing'],
    targetTlds: ['.com', '.io', '.net']
  },
  {
    slug: 'education',
    displayName: 'Education & Online Courses',
    keywords: ['education', 'learn', 'course', 'tutorial', 'training', 'academy', 'school', 'university', 'study', 'bootcamp', 'coding', 'programming'],
    targetTlds: ['.com', '.io', '.net']
  },
  {
    slug: 'travel',
    displayName: 'Travel & Tourism',
    keywords: ['travel', 'hotel', 'flight', 'vacation', 'booking', 'tourism', 'resort', 'airbnb', 'hostel', 'destination', 'backpack'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'real_estate',
    displayName: 'Real Estate',
    keywords: ['realestate', 'property', 'house', 'apartment', 'mortgage', 'rent', 'realtor', 'home', 'housing', 'condo'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'legal',
    displayName: 'Legal Services',
    keywords: ['legal', 'lawyer', 'attorney', 'law', 'court', 'divorce', 'injury', 'criminal', 'immigration'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'pets_dogs',
    displayName: 'Pets — Dogs',
    keywords: ['dog', 'puppy', 'canine', 'dogfood', 'dogtraining', 'petcare', 'dogbreed', 'veterinary'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'pets_cats',
    displayName: 'Pets — Cats',
    keywords: ['cat', 'kitten', 'feline', 'catfood', 'catcare', 'catbreed'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'fitness_gyms',
    displayName: 'Fitness & Gyms',
    keywords: ['fitness', 'gym', 'workout', 'exercise', 'bodybuilding', 'crossfit', 'strength', 'cardio', 'personaltrainer'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'recipes_cooking',
    displayName: 'Recipes & Cooking',
    keywords: ['recipe', 'cooking', 'food', 'kitchen', 'baking', 'meal', 'chef', 'restaurant', 'cuisine'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'dating_relationships',
    displayName: 'Dating & Relationships',
    keywords: ['dating', 'relationship', 'love', 'match', 'singles', 'romance', 'marriage', 'couple'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'web_hosting',
    displayName: 'Web Hosting & Cloud',
    keywords: ['hosting', 'webhosting', 'cloud', 'server', 'vps', 'wordpress', 'domain', 'website', 'ssl'],
    targetTlds: ['.com', '.io', '.net']
  },
  {
    slug: 'video_games',
    displayName: 'Video Games',
    keywords: ['game', 'gaming', 'esport', 'playstation', 'xbox', 'nintendo', 'steam', 'gamer', 'videogame'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'crypto',
    displayName: 'Crypto & Web3',
    keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'defi', 'web3', 'token', 'wallet', 'mining'],
    targetTlds: ['.com', '.io', '.net']
  },
  {
    slug: 'make_money_online',
    displayName: 'Make Money Online',
    keywords: ['makemoney', 'passiveincome', 'sidehustle', 'freelance', 'entrepreneur', 'onlinebusiness', 'income', 'profit'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'supplements_vitamins',
    displayName: 'Supplements & Vitamins',
    keywords: ['supplement', 'vitamin', 'protein', 'creatine', 'collagen', 'probiotic', 'omega', 'mineral'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'skincare_cosmetics',
    displayName: 'Skincare & Cosmetics',
    keywords: ['skincare', 'cosmetics', 'beauty', 'moisturizer', 'serum', 'makeup', 'antiaging', 'sunscreen'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'solar_energy',
    displayName: 'Solar Energy',
    keywords: ['solar', 'solarpanel', 'renewable', 'energy', 'greenenergy', 'cleanenergy', 'solarpower'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'home_improvement',
    displayName: 'Home Improvement & DIY',
    keywords: ['home', 'renovation', 'diy', 'remodel', 'kitchen', 'bathroom', 'plumbing', 'roofing', 'contractor'],
    targetTlds: ['.com', '.net']
  },
  {
    slug: 'mental_health',
    displayName: 'Mental Health & Therapy',
    keywords: ['mentalhealth', 'therapy', 'anxiety', 'depression', 'counseling', 'psychologist', 'mindfulness', 'stress'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'streaming_services',
    displayName: 'Streaming Services',
    keywords: ['streaming', 'netflix', 'hulu', 'disneyplus', 'hbomax', 'cordcutting', 'streamingservice', 'ondemand'],
    targetTlds: ['.com', '.net', '.tv']
  },
  {
    slug: 'developer_tools',
    displayName: 'Developer Tools',
    keywords: ['developer', 'devtools', 'github', 'code', 'programming', 'ide', 'docker', 'devops', 'api', 'framework'],
    targetTlds: ['.com', '.io', '.dev']
  },
  {
    slug: 'gambling_casinos',
    displayName: 'Gambling & Casinos',
    keywords: ['casino', 'gambling', 'poker', 'betting', 'slots', 'sportsbetting', 'blackjack', 'roulette'],
    targetTlds: ['.com', '.net', '.io']
  },
  {
    slug: 'music_instruments',
    displayName: 'Music & Instruments',
    keywords: ['music', 'guitar', 'piano', 'instrument', 'drum', 'band', 'recording', 'producer', 'songwriter'],
    targetTlds: ['.com', '.net']
  }
]

export async function GET() {
  try {
    let seeded = 0

    for (const niche of ALL_NICHES) {
      await prisma.niche.upsert({
        where: { slug: niche.slug },
        update: {
          displayName: niche.displayName,
          keywords: niche.keywords,
          targetTlds: niche.targetTlds,
          active: true,
        },
        create: {
          slug: niche.slug,
          displayName: niche.displayName,
          keywords: niche.keywords,
          targetTlds: niche.targetTlds,
          active: true,
        },
      })
      seeded++
    }

    return NextResponse.json({
      success: true,
      seeded,
      message: `Upserted ${seeded} niches — all active`,
    })
  } catch (error) {
    console.error('Seed niches error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
