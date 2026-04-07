import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputPath = resolve(repoRoot, "ui", "buildInfo.js");

function git(cmd) {
  return execSync(cmd, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

const fullSha = git("git log -1 --format=%H");
const shortSha = git("git log -1 --format=%h");
const message = git("git log -1 --format=%s").replace(/\\/g, "\\\\").replace(/`/g, "\\`");
const committedAtIso = git("git log -1 --format=%cI");
const committedAt = committedAtIso
  ? new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(committedAtIso))
  : "";

const content = `export const BUILD_INFO = {
  shortSha: ${JSON.stringify(shortSha)},
  fullSha: ${JSON.stringify(fullSha)},
  message: ${JSON.stringify(message)},
  committedAt: ${JSON.stringify(committedAt)},
};
`;

writeFileSync(outputPath, content, "utf8");
console.log(`Stamped ${outputPath} with ${shortSha} ${message}`);
