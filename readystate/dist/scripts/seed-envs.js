import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.environment.upsert({
        where: { name: "staging" },
        update: { currentSha: "dummy_staging" },
        create: { name: "staging", currentSha: "dummy_staging" },
    });
    await prisma.environment.upsert({
        where: { name: "production" },
        update: { currentSha: "dummy_production" },
        create: { name: "production", currentSha: "dummy_production" },
    });
    console.log("Seeded environments.");
}
main().catch(console.error);
