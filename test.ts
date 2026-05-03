import { PrismaClient } from '@prisma/client';

try {
  const prisma = new PrismaClient({ url: process.env.DATABASE_URL || "postgresql://a:b@localhost/db" });
  console.log("Success with url");
} catch (e) {
  console.error("Failed with url", e);
}
