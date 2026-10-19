"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { evaluateAudits } = require("./audit-review.cjs");

const root = path.resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const archive = readFileSync(path.join(root, "vendor/braces-3.0.3.tgz"));

const expectedNames = [
  "@next/eslint-plugin-next", "braces", "eslint-config-next", "fast-glob", "micromatch",
];
const advisory = {
  name: "braces", url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};
const counts = (total, high) => ({ info: 0, low: 0, moderate: 0, high, critical: 0, total });
const report = (total, vulnerabilities) => ({
  metadata: { vulnerabilities: counts(total, total) }, vulnerabilities,
});
const clean = () => report(0, {});
const known = () => report(5, {
  braces: { severity: "high", via: [{ ...advisory }] },
  micromatch: { severity: "high", via: ["braces"] },
  "fast-glob": { severity: "high", via: ["micromatch"] },
  "@next/eslint-plugin-next": { severity: "high", via: ["fast-glob"] },
  "eslint-config-next": { severity: "high", via: ["@next/eslint-plugin-next"] },
});
const check = (prod, full, testedLock = lock, testedPkg = pkg, testedArchive = archive) =>
  evaluateAudits(prod, full, testedLock, testedPkg, testedArchive);

test("clean production and full audits pass without waiving anything", () => {
  const result = check(clean(), clean());
  assert.equal(result.status, "PASS");
  assert.equal(result.exitCode, 0);
});

test("the exact previously reviewed development chain still requires manual review", () => {
  const result = check(clean(), known());
  assert.equal(result.status, "MANUAL_SECURITY_REVIEW_REQUIRED");
  assert.equal(result.exitCode, 2);
  assert.equal(result.formallyApproved, false);
  assert.deepEqual(result.packages, expectedNames);
});

test("new production vulnerability always blocks, even when full audit is unchanged", () => {
  const prod = report(1, { "new-runtime-vulnerability": { severity: "high", via: [] } });
  assert.equal(check(prod, known()).exitCode, 1);
});

test("new development advisory never gets grouped into the existing braces exception", () => {
  const full = known();
  full.vulnerabilities["unrelated-dependency"] = { severity: "high", via: [] };
  full.metadata.vulnerabilities = counts(6, 6);
  assert.equal(check(clean(), full).status, "BLOCKED");
});

test("different vulnerability on existing package does not inherit braces review", () => {
  const full = known();
  full.vulnerabilities.micromatch.via.push({
    name: "micromatch", url: "https://github.com/advisories/OTHER",
  });
  assert.equal(check(clean(), full).exitCode, 1);
});

test("changed advisory identity, chain or severity blocks", () => {
  for (const edit of [
    full => { full.vulnerabilities.braces.via[0].url = "https://example.invalid/new-id"; },
    full => { full.vulnerabilities.braces.via[0].name = "unrelated"; },
    full => { full.vulnerabilities["fast-glob"].via = ["not-micromatch"]; },
    full => { full.vulnerabilities.braces.severity = "critical"; },
  ]) {
    const full = known();
    edit(full);
    assert.equal(check(clean(), full).exitCode, 1);
  }
});

test("missing or inconsistent audit metadata is blocked", () => {
  const invalid = known();
  delete invalid.metadata;
  assert.equal(check(clean(), invalid).exitCode, 1);
  const mismatch = known();
  mismatch.metadata.vulnerabilities.total = 6;
  assert.equal(check(clean(), mismatch).exitCode, 1);
});

test("a mismatched lock integrity, vendored archive or root dependency blocks", () => {
  const changedLock = structuredClone(lock);
  changedLock.packages["node_modules/braces"].integrity = "sha512-invalid";
  assert.equal(check(clean(), known(), changedLock).exitCode, 1);
  assert.equal(check(clean(), known(), lock, pkg, Buffer.from("tampered archive")).exitCode, 1);
  const changedPkg = structuredClone(pkg);
  changedPkg.dependencies.braces = "3.0.3";
  assert.equal(check(clean(), known(), lock, changedPkg).exitCode, 1);
});

test("a swapped vendor tarball with a recomputed lockfile must not inherit reviewed status", () => {
  const modified = Buffer.concat([archive, Buffer.from("unexpected custom security patch")]);
  const adjustedLock = structuredClone(lock);
  adjustedLock.packages["node_modules/braces"].integrity =
    "sha512-" + createHash("sha512").update(modified).digest("base64");
  assert.equal(check(clean(), known(), adjustedLock, pkg, modified).exitCode, 1);
});
