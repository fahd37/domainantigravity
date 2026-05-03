export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const domains = await prisma.domain.findMany({
      where: { status: "BOUGHT" },
      include: {
        articles: {
          select: { id: true, title: true, slug: true, wordCount: true, publishedAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ domains });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
