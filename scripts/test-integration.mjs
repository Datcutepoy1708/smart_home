import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
loadEnvFile(new URL("../.env", import.meta.url));
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Local database required");
url.pathname = "/smart_home_test";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  RUN_DB_TESTS: "1",
  NODE_ENV: "test",
};
const migration = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "apps/api/prisma/schema.prisma",
  ],
  { env, stdio: "inherit" },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
const tests = spawnSync(
  process.execPath,
  [
    "../../node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.config.e2e.ts",
  ],
  { cwd: new URL("../apps/api", import.meta.url), env, stdio: "inherit" },
);
process.exitCode = tests.status ?? 1;
