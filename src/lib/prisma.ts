import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined | null;
}

function createPrismaClient(): PrismaClient {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("DATABASE_URL is not set. Prisma will run in disconnected mode.");
      // Return a proxy that just throws an error if called, allowing safe initialization
      return new Proxy({} as PrismaClient, {
        get() {
          return () => { throw new Error("Database not connected"); };
        }
      });
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (error) {
    console.error("Failed to initialize Prisma Client:", error);
    return new Proxy({} as PrismaClient, {
      get() {
        return () => { throw new Error("Database not connected"); };
      }
    });
  }
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
