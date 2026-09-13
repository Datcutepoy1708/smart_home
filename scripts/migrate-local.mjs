import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
loadEnvFile(new URL("../.env", import.meta.url));
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Local database required");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "apps/api/prisma/schema.prisma",
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
