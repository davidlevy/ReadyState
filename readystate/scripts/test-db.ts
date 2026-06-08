import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Inserting staging environment...')
  const env = await prisma.environment.upsert({
    where: { name: 'staging' },
    update: { currentSha: 'fake-sha-123' },
    create: { name: 'staging', currentSha: 'fake-sha-123' },
  })
  
  console.log('Environment upserted:', env)
  
  const envCount = await prisma.environment.count()
  console.log(`Total environments: ${envCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
