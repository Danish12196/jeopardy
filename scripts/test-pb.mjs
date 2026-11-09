// Runs a throwaway local PocketBase for tests, then runs a command against it.
//
//   node scripts/test-pb.mjs [--keep] [--no-seed] -- <command> [args...]
//
// 1. Downloads PocketBase (PB_VERSION, default below) into .pb/ if missing.
// 2. Starts it on a free port with a fresh temp data dir.
// 3. Creates a superuser, runs scripts/init-db.mjs and scripts/seed-test.mjs.
// 4. Runs <command> with PB_URL, VITE_PB_URL, PB_SUPERUSER_EMAIL and
//    PB_SUPERUSER_PASSWORD set, then stops PocketBase and deletes the data dir.
//
// With no command it just starts PocketBase and waits (Ctrl+C to stop), which
// is handy for poking at the admin UI. Never point this at a real server.

import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

export const PB_VERSION = process.env.PB_VERSION || "0.29.3";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PB_DIR = path.join(ROOT, ".pb", PB_VERSION);
const BIN = path.join(PB_DIR, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");

export const SUPERUSER_EMAIL = "admin@lockout.test";
export const SUPERUSER_PASSWORD = "lockout-test-password";

function platformAsset() {
  const os = { linux: "linux", darwin: "darwin", win32: "windows" }[process.platform];
  const arch = { x64: "amd64", arm64: "arm64" }[process.arch];
  if (!os || !arch) throw new Error(`No PocketBase build for ${process.platform}/${process.arch}`);
  return `pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
}

async function download() {
  if (existsSync(BIN)) return;
  mkdirSync(PB_DIR, { recursive: true });
  const asset = platformAsset();
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${asset}`;
  console.log(`[test-pb] downloading ${url}`);
  const zip = path.join(PB_DIR, asset);
  let res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(url);
    if (res.ok) break;
    console.warn(`[test-pb] download failed (${res.status}), retry ${attempt}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  const unzip = spawnSync("unzip", ["-o", zip, "-d", PB_DIR], { stdio: "inherit" });
  if (unzip.status !== 0) throw new Error("unzip failed (is `unzip` installed?)");
  rmSync(zip);
  chmodSync(BIN, 0o755);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`PocketBase did not become healthy at ${url}`);
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

/**
 * Starts PocketBase with a fresh schema and seed data.
 * Returns { url, env, stop }.
 */
export async function startTestPocketBase({ seed = true, init = true, log = false } = {}) {
  await download();
  const dataDir = mkdtempSync(path.join(tmpdir(), "lockout-pb-"));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  // Keep generated migrations inside the throwaway dir and don't write any:
  // the schema comes from init-db.mjs, not from migration files.
  const dirs = [`--dir=${dataDir}`, `--migrationsDir=${path.join(dataDir, "migrations")}`, "--automigrate=false"];
  const su = spawnSync(BIN, ["superuser", "upsert", SUPERUSER_EMAIL, SUPERUSER_PASSWORD, ...dirs], { encoding: "utf8" });
  if (su.status !== 0) throw new Error(`superuser upsert failed: ${su.stderr || su.stdout}`);

  const proc = spawn(BIN, ["serve", `--http=127.0.0.1:${port}`, ...dirs], {
    stdio: log ? "inherit" : "ignore",
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (proc.exitCode === null) {
      const exited = new Promise((r) => proc.once("exit", r));
      proc.kill("SIGTERM");
      await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }
    rmSync(dataDir, { recursive: true, force: true });
  };

  try {
    await waitForHealth(url);
    const env = {
      ...process.env,
      PB_URL: url,
      VITE_PB_URL: url,
      PB_SUPERUSER_EMAIL: SUPERUSER_EMAIL,
      PB_SUPERUSER_PASSWORD: SUPERUSER_PASSWORD,
    };
    const node = process.execPath;
    if (init && (await run(node, [path.join(ROOT, "scripts/init-db.mjs"), "--sync-rules"], env)) !== 0) throw new Error("init-db.mjs failed");
    if (seed && (await run(node, [path.join(ROOT, "scripts/seed-test.mjs")], env)) !== 0) throw new Error("seed-test.mjs failed");
    return { url, env, stop, dataDir };
  } catch (err) {
    await stop();
    throw err;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dash = argv.indexOf("--");
  const flags = dash === -1 ? argv : argv.slice(0, dash);
  const command = dash === -1 ? [] : argv.slice(dash + 1);

  const pbHandle = await startTestPocketBase({ seed: !flags.includes("--no-seed"), log: flags.includes("--log") });
  console.log(`[test-pb] PocketBase ${PB_VERSION} running at ${pbHandle.url}`);

  const cleanup = async () => { await pbHandle.stop(); };
  process.on("SIGINT", async () => { await cleanup(); process.exit(130); });
  process.on("SIGTERM", async () => { await cleanup(); process.exit(143); });

  if (!command.length) {
    console.log("[test-pb] no command given; press Ctrl+C to stop.");
    return; // keep running until a signal arrives
  }

  const code = await run(command[0], command.slice(1), pbHandle.env);
  await cleanup();
  process.exit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[test-pb]", err.message);
    process.exit(1);
  });
}
