import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    adapter: new PrismaMariaDb({
      host:      process.env.DB_HOST ?? "127.0.0.1",
      port:      Number(process.env.DB_PORT ?? 3306),
      user:      process.env.DB_USER ?? "root",
      password:  process.env.DB_PASS ?? "rootpassword",
      database:  process.env.DB_NAME ?? "terragroup",
      charset:   "utf8mb4",
      collation: "utf8mb4_unicode_ci",
    }),
  },
});
