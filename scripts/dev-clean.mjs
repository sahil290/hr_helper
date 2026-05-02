import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const PORTS_TO_CLEAR = [3000, 3001, 3002, 3003, 3004, 3005];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      shell: process.platform === "win32",
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function killWindowsPid(pid) {
  await run("taskkill", ["/PID", String(pid), "/F"]);
}

async function clearBusyPorts() {
  if (process.platform !== "win32") return;

  const result = await run("netstat", ["-ano"]);
  if (result.code !== 0) return;

  const lines = result.stdout.split(/\r?\n/);
  const pids = new Set();

  for (const line of lines) {
    if (!line.includes("LISTENING")) continue;

    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 5) continue;

    const localAddress = tokens[1] || "";
    const pid = Number(tokens[tokens.length - 1]);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    for (const port of PORTS_TO_CLEAR) {
      if (localAddress.endsWith(`:${port}`)) {
        pids.add(pid);
      }
    }
  }

  for (const pid of pids) {
    // Skip killing current process even though it's not listening on those ports.
    if (pid === process.pid) continue;
    await killWindowsPid(pid);
  }
}

async function removeNextCache() {
  const nextPath = path.join(process.cwd(), ".next");
  await fs.rm(nextPath, { recursive: true, force: true });
}

async function startDevServer() {
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  console.log("Cleaning dev environment...");
  await clearBusyPorts();
  await removeNextCache();
  console.log("Starting Next.js dev server...");
  await startDevServer();
}

main().catch((err) => {
  console.error("dev:clean failed");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
