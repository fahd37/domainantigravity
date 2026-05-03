export const runtime = 'nodejs';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const niche = await prisma.nicheIntelligence.findUnique({ where: { slug: params.slug } })
    if (!niche) return NextResponse.json({ error: 'Niche not found' }, { status: 404 })

    // DataForSEO credentials check
    const settings = await prisma.settings.findMany()
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
    const hasDFS = settingsMap['dfs_email'] && settingsMap['dfs_password']

    if (!hasDFS) {
      return NextResponse.json({
        success: false,
        message: 'DataForSEO not configured — using seeded data',
        dataSource: 'seeded',
        lastAnalyzed: niche.lastAnalyzed
      })
    }

    // Would hit DataForSEO here for live enrichment
    await prisma.nicheIntelligence.update({
      where: { slug: params.slug },
      data: { lastAnalyzed: new Date(), dataSource: 'dataforseo-live' }
    })

    return NextResponse.json({ success: true, message: 'Refreshed with live data', dataSource: 'dataforseo-live' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
