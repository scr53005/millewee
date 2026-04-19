import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
import { env } from "process";

// Load .env.local first (Next.js convention), fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  datasource: {
    url: process.env.POSTGRES_URL!,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL!,
  },
});
