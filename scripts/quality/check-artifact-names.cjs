#!/usr/bin/env node
"use strict";
/**
 * Repository artifact naming guard. Checks versioned/added files and local QA
 * evidence; intentionally excludes tool-managed node_modules, .git, .next,
 * browser test-results, build output and platform cache trees.
 */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const projectRoot = path.resolve(__dirname, "../..");
const tracked = cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: projectRoot, encoding: "utf8",
}).split("\0").filter(Boolean);
const milestone = /phase/i;
const failures = new Set();
for (const name of tracked) {
  // Unstaged deletions remain in the Git index until commit; check actual working-tree files.
  if (!fs.existsSync(path.join(projectRoot, name))) continue;
  if (name.split("/").some(part => milestone.test(part))) failures.add(name);
}
const evidence = path.join(projectRoot, "frontend", "quality-audit", ".evidence");
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (milestone.test(item.name)) failures.add(path.relative(projectRoot, full));
    if (item.isDirectory()) walk(full);
  }
}
walk(evidence);
if (failures.size) {
  console.error("Artifact filename policy failed. Use feature/behavior/topic names, never milestone names:");
  for (const name of [...failures].sort()) console.error(" - " + name);
  process.exitCode = 1;
} else {
  console.log("PASS: " + tracked.length + " repository file paths and ignored QA evidence have no milestone-named files/directories.");
}
