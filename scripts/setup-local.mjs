import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const template = readFileSync(new URL(".env.example", root), "utf8");
const password = randomBytes(24).toString("hex");
const environment = template
  .replaceAll("change-me-for-non-local-use", password)
  .replace(
    "replace-with-at-least-32-characters",
    randomBytes(32).toString("hex"),
  )
  .replace(
    "replace-with-a-different-32-character-secret",
    randomBytes(32).toString("hex"),
  );

try {
  writeFileSync(new URL(".env", root), environment, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Created local .env. Existing database volumes keep their original password.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Existing .env preserved.");
}
