import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Bound each serverless instance's pool instead of Prisma's CPU-based default.
// Explicit connection settings in DATABASE_URL always take precedence.
const databaseUrl = process.env.DATABASE_URL;
const datasourceUrl = databaseUrl ? new URL(databaseUrl) : null;
if (datasourceUrl) {
  for (const [key, value] of Object.entries({
    connection_limit: "3",
    pool_timeout: "8",
    connect_timeout: "8",
  })) {
    if (!datasourceUrl.searchParams.has(key))
      datasourceUrl.searchParams.set(key, value);
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    ...(datasourceUrl ? { datasourceUrl: datasourceUrl.toString() } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
