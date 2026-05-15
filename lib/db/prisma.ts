import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

function createPrismaClient() {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);

  return {
    prisma: new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    }),
    pool,
  };
}

const prismaSingleton =
  globalForPrisma.prisma && globalForPrisma.prismaPool
    ? { prisma: globalForPrisma.prisma, pool: globalForPrisma.prismaPool }
    : createPrismaClient();

export const prisma = prismaSingleton.prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaSingleton.prisma;
  globalForPrisma.prismaPool = prismaSingleton.pool;
}
