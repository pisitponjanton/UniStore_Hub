"use strict";

/**
 * A deliberately non-waiving security gate.
 *
 * Exit 0 = both audits clean.
 * Exit 2 = only the specifically documented development-only braces advisory
 *          remains; manual security approval is still required.
 * Exit 1 = unknown/new advisory, broken audit, invalid lock, or other failure.
 *
 * This script never suppresses npm audit and never grants risk acceptance.
 */

const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");
const EXPECTED = Object.freeze([
  "@next/eslint-plugin-next",
  "braces",
  "eslint-config-next",
  "fast-glob",
  "micromatch",
].sort());
const GHSA = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const VEND = "file:vendor/braces-3.0.3.tgz";
// SHA-256 of the exact MIT-sourced, locally reviewed package from
// docs/design/BRACES_PATCH_TECHNICAL_REVIEW.md. This value MUST NOT be
// auto-updated during npm install; a new package requires fresh review.
const REVIEWED_ARCHIVE_SHA256 = "cf9d1ceef10badc2a90da5550fd235bcbb33b1f96cafcd22cd42afac84e485e4";

function readAudit(args) {
  const result = spawnSync("npm", ["audit", ...args, "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("npm audit could not complete: " +
      (result.error?.message || result.stderr || "exit " + result.status));
  }
  try {
    const report = JSON.parse(result.stdout);
    if (!report.metadata?.vulnerabilities || !report.vulnerabilities) {
      throw new Error("missing vulnerability summary");
    }
    return report;
  } catch (error) {
    throw new Error("npm audit JSON is invalid: " + error.message);
  }
}

function isCounts(summary, expectedTotal, expectedHigh) {
  if (!summary || summary.total !== expectedTotal ||
      summary.high !== expectedHigh) return false;
  return ["critical", "moderate", "low", "info"].every(
    key => summary[key] === 0
  );
}

function evaluateAudits(prod, full, lock, pkg, archive) {
  const prodSummary = prod?.metadata?.vulnerabilities;
  const fullSummary = full?.metadata?.vulnerabilities;
  const prodNames = Object.keys(prod?.vulnerabilities ?? {});
  const fullNames = Object.keys(full?.vulnerabilities ?? {}).sort();
  const entry = lock?.packages?.["node_modules/braces"];
  const actualSRI = "sha512-" + createHash("sha512").update(archive).digest("base64");
  const reviewedArchive = createHash("sha256").update(archive).digest("hex") ===
    REVIEWED_ARCHIVE_SHA256;
  const lockValid = reviewedArchive && pkg?.devDependencies?.braces === VEND &&
    !pkg?.dependencies?.braces &&
    !pkg?.overrides?.braces &&
    entry?.version === "3.0.3" &&
    entry?.dev === true &&
    entry?.resolved === VEND &&
    entry?.integrity === actualSRI;

  if (!lockValid) {
    return { status: "BLOCKED", reason: "Local braces archive or lockfile integrity mismatch", exitCode: 1 };
  }
  if (prodNames.length || !isCounts(prodSummary, 0, 0)) {
    return { status: "BLOCKED", reason: "Production audit has findings or invalid counts", exitCode: 1,
      production: prodSummary, packages: prodNames };
  }
  if (!fullSummary || !Array.isArray(fullNames)) {
    return { status: "BLOCKED", reason: "Full audit missing", exitCode: 1 };
  }
  if (isCounts(fullSummary, 0, 0) && fullNames.length === 0) {
    return { status: "PASS", reason: "Both npm audits report zero vulnerabilities", exitCode: 0 };
  }

  const expectedNames = fullNames.length === EXPECTED.length &&
    EXPECTED.every((name, index) => fullNames[index] === name);
  const allHigh = fullNames.every(name => full.vulnerabilities[name].severity === "high");
  const expectedVia = {
    braces: null, // Security advisory object validated separately below.
    micromatch: ["braces"],
    "fast-glob": ["micromatch"],
    "@next/eslint-plugin-next": ["fast-glob"],
    "eslint-config-next": ["@next/eslint-plugin-next"],
  };
  // A second security issue can affect an *existing* package. Requiring the
  // exact transitive "via" chain prevents incorrectly classifying it as the
  // previously reviewed braces issue.
  const reachesOnlyKnownChain = Object.entries(expectedVia)
    .filter(([name]) => name !== "braces")
    .every(([name, via]) => {
      const actual = full.vulnerabilities[name]?.via;
      return Array.isArray(actual) && actual.length === via.length &&
        actual.every((value, index) => value === via[index]);
    });
  const bracesVia = full.vulnerabilities?.braces?.via ?? [];
  const onlyGHSA = bracesVia.length === 1 &&
    bracesVia[0] !== null &&
    typeof bracesVia[0] === "object" &&
    bracesVia[0].name === "braces" &&
    bracesVia[0].url === GHSA;
  const noOtherKnownVulnerabilities = expectedNames &&
    isCounts(fullSummary, EXPECTED.length, EXPECTED.length) && allHigh &&
    reachesOnlyKnownChain && onlyGHSA;

  if (!noOtherKnownVulnerabilities) {
    return { status: "BLOCKED", reason: "Unexpected audit finding or changed dependency/advisory identity",
      exitCode: 1, full: fullSummary, packages: fullNames };
  }
  return {
    status: "MANUAL_SECURITY_REVIEW_REQUIRED",
    reason: "Exactly the five upstream braces advisory nodes remain in development-only ESLint",
    exitCode: 2, production: prodSummary, full: fullSummary,
    advisory: GHSA, packages: fullNames,
    patchedLocally: true, formallyApproved: false,
  };
}

function main() {
  let output;
  try {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(path.join(projectRoot, "package-lock.json"), "utf8"));
    const archive = readFileSync(path.join(projectRoot, "vendor/braces-3.0.3.tgz"));
    // Check the *installed* code and behavior, not just matching metadata.
    // A missing, replaced or broken node_modules copy must fail closed.
    const localPatch = spawnSync(process.execPath,
      [path.join(projectRoot, "scripts/security/verify-braces.cjs")], {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 25_000,
        maxBuffer: 1024 * 1024,
      });
    if (localPatch.error || localPatch.status !== 0) {
      throw new Error("Installed braces patch verification failed: " +
        (localPatch.error?.message || localPatch.stderr || localPatch.stdout ||
        "exit " + localPatch.status).slice(0, 800));
    }
    const prod = readAudit(["--omit=dev"]);
    const full = readAudit([]);
    output = evaluateAudits(prod, full, lock, pkg, archive);
  } catch (error) {
    output = { status: "BLOCKED", reason: error.message, exitCode: 1 };
  }
  const reportPath = path.join(projectRoot, "quality-audit", ".evidence",
    "security-upgrade", "audit-review-gate.json");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    ...output,
    disclaimer: "Audit comparison is a gate, NOT an exception, security waiver, or production approval.",
  }, null, 2) + "\n");
  console.log(output.status + ": " + output.reason);
  if (output.advisory) console.log(output.advisory);
  console.log("Evidence:", reportPath);
  process.exitCode = output.exitCode;
}

module.exports = { evaluateAudits };
if (require.main === module) main();
