import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const keywords = await prisma.nicheKeyword.findMany({ where: { nicheSlug: params.slug } })
    return NextResponse.json({ keywords })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
