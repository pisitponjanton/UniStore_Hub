"use strict";

const { spawnSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const allowed = ["chromium", "firefox", "webkit"];
const selected = process.argv.slice(2);
if (selected.some(browser => !allowed.includes(browser)) || new Set(selected).size !== selected.length) {
  console.error("Usage: node scripts/quality/run-cross-role-regression.cjs [chromium] [firefox] [webkit]");
  process.exit(2);
}

// This is a local, read-only QA helper. Never inherit integration/production
// targets even if another Playwright command supports disposable integration.
for (const target of [process.env.E2E_FRONTEND_BASE_URL, process.env.E2E_API_BASE_URL]) {
  if (!target) continue;
  let hostname;
  try { hostname = new URL(target).hostname; }
  catch { console.error("Invalid E2E target URL:", target); process.exit(2); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    console.error("Cross-role smoke tests accept only loopback targets.");
    process.exit(2);
  }
}

const browsers = selected.length ? selected : allowed;
const specs = [
  "e2e/quality-audit/account-role-entry.spec.ts",
  "e2e/quality-audit/customer-responsive-journey.spec.ts",
  "e2e/quality-audit/staff-operations-responsive.spec.ts",
  "e2e/quality-audit/organization-management-responsive.spec.ts",
  "e2e/quality-audit/platform-administration-responsive.spec.ts",
  "e2e/quality-audit/commerce-detail-journeys.spec.ts",
  "e2e/quality-audit/multi-role-modal-accessibility.spec.ts",
];

// A Playwright invocation clears its outputDir. Keep each browser's traces
// distinct, and never start two engines in parallel against seeded accounts.
const projectRoot = resolve(__dirname, "../..");
const runName = new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid;
const evidence = join(projectRoot, "quality-audit", ".evidence", "cross-role-regression", runName);
mkdirSync(evidence, { recursive: true });

const report = { runName, results: [], scope: "Read-only local browser regression with intercepted mutations" };
let hasFailures = false;
for (const browser of browsers) {
  const args = ["playwright", "test", ...specs, "--project=" + browser,
    "--output=" + join(evidence, browser, "artifacts"), "--reporter=line"];
  const started = Date.now();
  const result = spawnSync("npx", args, {
    cwd: projectRoot,
    env: { ...process.env, E2E_ENABLE_CROSS_BROWSER: "1" },
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
    timeout: 240_000,
  });
  const log = [result.stdout || "", result.stderr || "", result.error?.message || ""].join("\n");
  writeFileSync(join(evidence, browser + ".log"), log);
  const exitCode = result.status ?? 1;
  const summary = log.match(/\b\d+ passed \([^\n]+\)/g)?.at(-1) ?? "";
  report.results.push({ browser, exitCode, summary, seconds: Math.round((Date.now() - started) / 1000) });
  console.log(browser + ": " + (summary || "No passing test summary") + " (exit " + exitCode + ")");
  if (exitCode !== 0) hasFailures = true;
  writeFileSync(join(evidence, "result.json"), JSON.stringify(report, null, 2) + "\n");
}

console.log("Evidence:", evidence);
if (hasFailures) process.exitCode = 1;
