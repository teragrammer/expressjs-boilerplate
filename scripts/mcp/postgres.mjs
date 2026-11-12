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
  if (ssl) {
    /*
     * Full verification: the server certificate and hostname must match
     * a trusted CA. DB_SSL_REJECT_UNAUTHORIZED is intentionally not
     * consulted here; tooling must not inherit an insecure override.
     */
    const params = new URLSearchParams({ sslmode: "verify-full" });
    if (process.env.DB_SSL_CA) {
      params.set("sslrootcert", process.env.DB_SSL_CA);
    }
    url += `?${params.toString()}`;
  }
} else {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") === "no-verify") {
      console.error(
        "Postgres MCP: sslmode=no-verify is not allowed; use sslmode=verify-full with a trusted CA.",
      );
      process.exit(1);
    }
  } catch {
    console.error("Postgres MCP: DATABASE_URL is not a valid URL");
    process.exit(1);
  }
}

const result = spawnSync("npx", ["-y", "@modelcontextprotocol/server-postgres", url], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 0);