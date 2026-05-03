export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.niche.count();
    
    // Auto-seed if empty (moved from server action)
    if (count === 0) {
      const defaultNiches = [
        { slug: "artificial_intelligence", displayName: "Artificial Intelligence" },
        { slug: "digital_marketing", displayName: "Digital Marketing" },
        { slug: "finance", displayName: "Finance" },
        { slug: "health_wellness", displayName: "Health & Wellness" },
        { slug: "ecommerce", displayName: "E-Commerce" },
        { slug: "saas_software", displayName: "SaaS & Software" },
        { slug: "travel", displayName: "Travel" },
        { slug: "real_estate", displayName: "Real Estate" },
        { slug: "legal", displayName: "Legal" },
        { slug: "education", displayName: "Education" },
      ];
      
      for (const niche of defaultNiches) {
        await prisma.niche.create({
          data: {
            slug: niche.slug,
            displayName: niche.displayName,
            keywords: [niche.displayName.toLowerCase()],
            targetTlds: [".com", ".io", ".ai", ".co"],
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
