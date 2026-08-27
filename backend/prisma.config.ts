import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 6 skips auto-loading .env when this file exists. Load it ourselves.
const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: "/home/ubuntu/Seznik-web/backend/.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
