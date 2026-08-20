let prismaInstance: any = null;

function getPrismaClient() {
  if (prismaInstance) {
    return prismaInstance;
  }

  // During build time, Prisma might not be available
  if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) {
    return null;
  }

  try {
    const { PrismaClient } = require("@prisma/client");

    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    });

    return prismaInstance;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Warning: Prisma client could not be initialized:", err);
    }
    return null;
  }
}

export const prisma = new Proxy(
  {},
  {
    get(target, prop) {
      const client = getPrismaClient();
      if (!client) {
        throw new Error(
          "Prisma client not initialized. Make sure MONGODB_URI is set."
        );
      }
      return (client as any)[prop];
    },
  }
) as any;

export default prisma;
