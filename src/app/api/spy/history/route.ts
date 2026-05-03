import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { patternToNicheConfig } from "@/lib/spy/pattern-extractor";
import type { WinningPattern } from "@/lib/spy/pattern-extractor";

export async function GET() {
  try {
    const history = await prisma.spyAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, analysisId, competitorDomain } = body;

    if (action === "import-niche") {
      // Load the analysis
      const analysis = await prisma.spyAnalysis.findUnique({ where: { id: analysisId } });
      if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

      const pattern = analysis.patterns as unknown as WinningPattern;
      const nicheConfig = patternToNicheConfig(pattern, competitorDomain || analysis.competitorInput);

      // Create the niche
      await prisma.niche.create({
        data: {
          slug: nicheConfig.slug,
          displayName: `Spy: ${competitorDomain || analysis.competitorInput}`,
          keywords: nicheConfig.keywords,
          targetTlds: nicheConfig.targetTlds,
          active: true,
        },
      });

      await prisma.spyAnalysis.update({ where: { id: analysisId }, data: { importedAsNiche: true } });

      return NextResponse.json({ success: true, slug: nicheConfig.slug });
    }

    // Default: save new analysis
    const { competitorInput, discoveredDomains, patterns } = body;
    const record = await prisma.spyAnalysis.create({
      data: { competitorInput, discoveredDomains, patterns, importedAsNiche: false },
    });
    return NextResponse.json({ success: true, id: record.id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
