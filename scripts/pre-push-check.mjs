import { spawn } from "node:child_process";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function main() {
  console.log("\nRunning pre-push checks...\n");
  await run("npm", ["run", "lint"]);
  await run("npm", ["run", "build"]);
  console.log("\nAll checks passed. Safe to push.\n");
}

main().catch((err) => {
  console.error("\nPre-push checks failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
