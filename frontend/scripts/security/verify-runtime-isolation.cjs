"use strict";

/**
 * Verifies that the reviewed development-only braces patch did not enter
 * the production Static Export. This does not certify all possible deploy
 * targets or replace the live npm production/full security audits.
 * Run AFTER "npm run build".
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const LOCAL_TARBALL = "file:vendor/braces-3.0.3.tgz";
const VENDORED_MARKERS = Object.freeze([
  "braces: maximum AST nesting exceeded",
  "braces: maximum flatten nesting exceeded",
  "braces: maximum expansion nesting exceeded",
  "GHSA-vfj7-8cjw-p6xm",
]);

function evaluateRuntimeIsolation(pkg, lock, assets) {
  const messages = [];
  if (pkg?.devDependencies?.braces !== LOCAL_TARBALL) {
    messages.push("braces must remain a direct local development dependency");
  }
  if (pkg?.dependencies?.braces || pkg?.optionalDependencies?.braces) {
    messages.push("braces must not become a production/optional dependency");
  }
  const installed = Object.entries(lock?.packages ?? {})
    .filter(([key]) => /(?:^|\/)node_modules\/braces$/.test(key));
  if (installed.length === 0) {
    messages.push("expected a locked braces installation");
  }
  for (const [key, entry] of installed) {
    if (entry?.dev !== true) {
      messages.push("braces not exclusively development-only: " + key);
    }
  }
  if (lock?.packages?.["node_modules/braces"]?.resolved !== LOCAL_TARBALL) {
    messages.push("braces lockfile no longer uses the reviewed local archive");
  }
  if (!Array.isArray(assets) || assets.length === 0) {
    messages.push("no static export assets found; build may be missing");
  } else {
    for (const { name, contents } of assets) {
      if (typeof contents !== "string") {
        messages.push("cannot inspect asset: " + name);
        continue;
      }
      for (const token of VENDORED_MARKERS) {
        if (contents.includes(token)) {
          messages.push("vendored developer security code unexpectedly shipped in: " + name);
          break;
        }
      }
    }
  }
  return { pass: messages.length === 0, messages,
    scannedAssets: Array.isArray(assets) ? assets.length : 0,
    lockedBracesPackages: installed.length };
}

function exportAssets(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  const result = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && /\.(?:html|js|mjs|css)$/i.test(entry.name)) {
        result.push({ name: path.relative(root, absolute),
          contents: fs.readFileSync(absolute, "utf8") });
      }
    }
  };
  walk(root);
  return result;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, "package-lock.json"), "utf8"));
  const assets = exportAssets(path.join(projectRoot, "out"));
  const result = evaluateRuntimeIsolation(pkg, lock, assets);
  assert.equal(result.pass, true,
    "Development-only braces isolation violated: " + result.messages.join("; "));
  console.log("PASS: braces remains a dev-only locked dependency and " +
    result.scannedAssets + " built static assets have no vendored vulnerability-guard code");
}

module.exports = { evaluateRuntimeIsolation };
if (require.main === module) main();
