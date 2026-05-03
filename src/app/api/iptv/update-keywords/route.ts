import { prisma } from '@/lib/prisma'
import { updateAllMarkets } from '@/lib/iptv/keyword-updater'

export async function POST(request: Request) {
  const { markets } = await request.json()

  const settings = await prisma.settings.findMany()
  const email = settings.find(s => s.key === 'dataForSeoEmail')?.value || ''
  const password = settings.find(s => s.key === 'dataForSeoPassword')?.value || ''

  if (!email || !password) {
    return Response.json({
      success: false,
      error: 'DataForSEO not configured — go to Settings first'
    }, { status: 400 })
  }

  const targetMarkets = markets || ['US', 'UK', 'FR', 'DE', 'NL', 'SE', 'NO', 'DK']
  const results = await updateAllMarkets(email, password, targetMarkets)

  return Response.json(results)
}
