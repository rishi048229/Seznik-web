import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 6 skips auto-loading .env when this file exists. Load it ourselves.
const root = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  path.join(root, ".env"),
  path.join(root, "..", ".env"),
  "/home/ubuntu/inventort-seznik/backend/.env",
  "/home/ubuntu/inventort-seznik/.env",
  "/home/ubuntu/Seznik-web/backend/.env",
]) {
  loadEnv({ path: envPath });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
