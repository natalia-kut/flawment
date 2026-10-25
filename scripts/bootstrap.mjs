import { copyFileSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal}).`);
  }
}

try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24)) {
    throw new Error("Use Node.js 24 LTS, or Node.js 20.19+ / 22.12+.");
  }
  // npm supplies its JavaScript entry point: no platform-specific shell or .cmd execution.
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run this script with npm run bootstrap.");

  run("docker", ["compose", "version"]);
  run("docker", ["info", "--format", "{{.ServerVersion}}"]);

  try {
    copyFileSync(new URL("../.env.example", import.meta.url), new URL("../.env", import.meta.url), constants.COPYFILE_EXCL);
    console.log("Created .env from .env.example.");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Keeping existing .env.");
  }

  run(process.execPath, [npm, "ci"]);
  run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120", "db"]);
  run(process.execPath, [npm, "run", "db:deploy"]);
  run(process.execPath, [npm, "run", "db:generate"]);

  console.log("\nBootstrap complete. Run npm run dev and open http://localhost:3000.");
} catch (error) {
  console.error(`\nBootstrap failed: ${error.message}`);
  console.error("Fix the error above, then rerun npm run bootstrap. Docker Desktop must be running in Linux container mode.");
  process.exitCode = 1;
}
