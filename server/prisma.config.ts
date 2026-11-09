import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, env } from "prisma/config";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, "server", ".env") });
dotenv.config({ path: path.join(rootDir, ".env.local"), override: true });
dotenv.config({ path: path.join(rootDir, "server", ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
