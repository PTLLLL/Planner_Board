import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.EMBEDDED_PG_DATA_DIR || path.join(root, "data", "postgres");
const port = Number(process.env.EMBEDDED_PG_PORT || 55432);
const database = process.env.EMBEDDED_PG_DATABASE || "planner_agent";
const user = "postgres";
const password = "postgres";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user,
  password,
  persistent: true,
});

async function ensureDatabase() {
  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (result.rowCount === 0) {
    await pg.createDatabase(database);
  }
  await client.end();
}

async function start() {
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  await ensureDatabase();
  console.log(`[dev-db] PostgreSQL ready at localhost:${port}/${database}`);
}

async function stop() {
  try {
    await pg.stop();
    console.log("[dev-db] PostgreSQL stopped");
  } catch (error) {
    console.warn(`[dev-db] stop warning: ${error.message}`);
  }
}

function runStep(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const command = process.argv[2] || "start";

if (command === "start") {
  await start();
  process.on("SIGINT", async () => {
    await stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await stop();
    process.exit(0);
  });
  setInterval(() => {}, 1 << 30);
} else if (command === "stop") {
  await stop();
} else if (command === "setup") {
  await start();
  runStep("npx", ["prisma", "db", "push", "--skip-generate"]);
  runStep("npx", ["tsx", "prisma/seed.ts"]);
  await stop();
} else {
  console.error("Unknown command. Use start, stop or setup.");
  process.exit(1);
}
