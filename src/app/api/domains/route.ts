export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const niche = searchParams.get("niche");
    
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (niche) where.niche = niche;

    const domains = await prisma.domain.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: domains });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const updated = await prisma.domain.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.domain.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
