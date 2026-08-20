const { PrismaClient } = require("@prisma/client");

const globalWithPrisma = global as typeof globalThis & {
  prisma?: any;
};

function createPrismaClient() {
  try {
    if (process.env.DATABASE_URL) {
      return new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
      });
    }
  } catch (err) {
    // Silently fail during build time if DB is not available
    if (process.env.NODE_ENV === "development") {
      console.warn("Warning: Prisma client could not be initialized:", err);
    }
  }
  return null;
}

if (!globalWithPrisma.prisma) {
  globalWithPrisma.prisma = createPrismaClient();
}

export const prisma = globalWithPrisma.prisma as any;

export default prisma;
