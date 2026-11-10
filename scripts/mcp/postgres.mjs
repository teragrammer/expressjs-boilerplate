import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load a simple .env file from the current working directory if present.
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const databaseUrl = process.env.DATABASE_URL;
let url = databaseUrl;

if (!url) {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASS;
  const name = process.env.DB_NAME;
  if (!host || !user || !name) {
    console.error("Postgres MCP: set DATABASE_URL or DB_HOST/DB_USER/DB_NAME in .env");
    process.exit(1);
  }
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass || "")}`;
  const ssl = process.env.DB_SSL === "true";
  url = `postgresql://${auth}@${host}:${port}/${name}`;
  if (ssl) url += "?sslmode=no-verify";
}

const result = spawnSync("npx", ["-y", "@modelcontextprotocol/server-postgres", url], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 0);