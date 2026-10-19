"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { evaluateRuntimeIsolation } = require("./verify-runtime-isolation.cjs");

const makePkg = () => ({
  dependencies: { next: "16.4.2" },
  devDependencies: { braces: "file:vendor/braces-3.0.3.tgz" },
});
const makeLock = () => ({ packages: {
  "node_modules/braces": { version: "3.0.3", dev: true,
    resolved: "file:vendor/braces-3.0.3.tgz" },
}});
const asset = (contents = "console.log('static output')") =>
  [{ name: "_next/static/chunks/page.js", contents }];

test("the approved local library remains absent from normal static exports", () => {
  const result = evaluateRuntimeIsolation(makePkg(), makeLock(), asset());
  assert.equal(result.pass, true);
  assert.equal(result.scannedAssets, 1);
  assert.equal(result.lockedBracesPackages, 1);
});

test("production and optional dependencies cannot acquire braces", () => {
  for (const section of ["dependencies", "optionalDependencies"]) {
    const pkg = makePkg();
    pkg[section] = { ...pkg[section], braces: "^3.0.3" };
    assert.equal(evaluateRuntimeIsolation(pkg, makeLock(), asset()).pass, false);
  }
});

test("production-marked or nested locked braces is blocked", () => {
  for (const bad of [
    lock => { lock.packages["node_modules/braces"].dev = false; },
    lock => { lock.packages["node_modules/pkg/node_modules/braces"] = { dev: false }; },
    lock => { lock.packages["node_modules/braces"].resolved = "https://example.invalid"; },
  ]) {
    const lock = makeLock();
    bad(lock);
    assert.equal(evaluateRuntimeIsolation(makePkg(), lock, asset()).pass, false);
  }
});

test("bundling the locally patched package is detected", () => {
  for (const marker of [
    "braces: maximum AST nesting exceeded",
    "braces: maximum flatten nesting exceeded",
    "braces: maximum expansion nesting exceeded",
    "GHSA-vfj7-8cjw-p6xm",
  ]) {
    assert.equal(evaluateRuntimeIsolation(makePkg(), makeLock(), asset(marker)).pass, false);
  }
});

test("a missing build or unreadable asset is not classified as a pass", () => {
  assert.equal(evaluateRuntimeIsolation(makePkg(), makeLock(), []).pass, false);
  assert.equal(evaluateRuntimeIsolation(makePkg(), makeLock(),
    [{ name: "page.js", contents: null }]).pass, false);
});

test("a missing root lockfile entry fails closed", () => {
  assert.equal(evaluateRuntimeIsolation(makePkg(), { packages: {} }, asset()).pass, false);
});
