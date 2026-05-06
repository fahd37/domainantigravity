export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const runs = await prisma.scanRun.findMany({
      orderBy: { endedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    console.error("Failed to fetch scan runs:", error);
    return NextResponse.json({ data: [] });
  }
}
