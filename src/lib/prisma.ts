const { PrismaClient } = require("@prisma/client");

const globalWithPrisma = global as typeof globalThis & {
  prisma?: any;
};

export const prisma =
  globalWithPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalWithPrisma.prisma = prisma;
}

export default prisma;
