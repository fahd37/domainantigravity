const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const defaultNiches = [
    { slug: "artificial_intelligence", displayName: "Artificial Intelligence", keywords: ['ai', 'artificial-intelligence', 'machine-learning', 'chatgpt', 'llm', 'neural', 'deeplearning', 'aitools'] },
    { slug: "digital_marketing", displayName: "Digital Marketing", keywords: ['seo', 'marketing', 'digitalmarketing', 'contentmarketing', 'socialmedia', 'emailmarketing', 'ppc', 'sem'] },
    { slug: "finance", displayName: "Finance", keywords: ['finance', 'investing', 'crypto', 'trading', 'fintech', 'budget', 'money', 'wealth'] },
    { slug: "health_wellness", displayName: "Health & Wellness", keywords: ['health', 'wellness', 'fitness', 'nutrition', 'diet', 'yoga', 'meditation', 'healthcoach'] },
    { slug: "ecommerce", displayName: "E-Commerce" },
    { slug: "saas_software", displayName: "SaaS & Software" },
    { slug: "travel", displayName: "Travel" },
    { slug: "real_estate", displayName: "Real Estate" },
    { slug: "legal", displayName: "Legal" },
    { slug: "education", displayName: "Education" },
  ];

  console.log("Seeding niches...");
  for (const niche of defaultNiches) {
    const keywords = niche.keywords || [niche.displayName.toLowerCase()];
    await prisma.niche.upsert({
      where: { slug: niche.slug },
      update: {
        keywords,
        active: true
      },
      create: {
        slug: niche.slug,
        displayName: niche.displayName,
        keywords,
        targetTlds: [".com", ".io", ".ai", ".co"],
        active: true,
      },
    });
  }
  console.log("Seeding completed.");
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
