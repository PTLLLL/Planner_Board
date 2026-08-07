import { execFileSync } from "node:child_process";

function redactUrl(value) {
  if (!value) return "(not set)";
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "(invalid URL)";
  }
}

console.log("[vercel-build] DATABASE_URL=" + redactUrl(process.env.DATABASE_URL));
console.log("[vercel-build] DIRECT_URL=" + redactUrl(process.env.DIRECT_URL));

function run(command, args, timeoutMs) {
  console.log(`[vercel-build] Running: ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    stdio: "inherit",
    timeout: timeoutMs,
    shell: process.platform === "win32",
  });
}

run("npx", ["prisma", "migrate", "deploy"], 180000);
run("npx", ["next", "build"], 600000);