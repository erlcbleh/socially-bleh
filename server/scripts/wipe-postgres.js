import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(rootDir, ".env"), override: true });
dotenv.config({ path: path.join(rootDir, "server", ".env"), override: true });

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL.includes("/socially")) {
  throw new Error(`Refusing to wipe unexpected DATABASE_URL (must target /socially): ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);
}

console.log(`Wiping Postgres: ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const tables = await prisma.$queryRawUnsafe(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
);

if (!tables.length) throw new Error("No public tables found");

const list = tables.map((t) => `"${t.tablename}"`).join(", ");
console.log(`Truncating: ${tables.map((t) => t.tablename).join(", ")}`);
await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
console.log("truncate-ok");

await prisma.$disconnect();
await pool.end();
