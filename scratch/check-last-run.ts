import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const lastRun = await prisma.scanRun.findFirst({
    orderBy: { startedAt: 'desc' }
  })
  console.log(JSON.stringify(lastRun, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
