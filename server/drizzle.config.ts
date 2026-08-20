import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Configuration Drizzle Kit pour les migrations PostgreSQL
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/logixstore",
  },
  strict: true,
  verbose: true,
});
