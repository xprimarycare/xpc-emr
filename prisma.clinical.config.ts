import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/clinical/schema.prisma",
  migrations: {
    path: "prisma/clinical/migrations",
  },
  datasource: {
    url: env("CLINICAL_DATABASE_URL"),
  },
});
