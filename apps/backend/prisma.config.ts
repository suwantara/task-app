import { defineConfig } from "prisma/config";
import { config as loadDotenv } from "dotenv";

loadDotenv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
