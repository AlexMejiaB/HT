import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Cliente Prisma único. En desarrollo se guarda en globalThis para que el
 * hot reload no abra una conexión nueva en cada recarga.
 */
const crearCliente = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

const global_ = globalThis as unknown as { prisma?: ReturnType<typeof crearCliente> };

export const db = global_.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") global_.prisma = db;
