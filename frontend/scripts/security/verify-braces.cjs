"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const project = path.resolve(__dirname, "../..");
const micromatchFile = require.resolve("micromatch");
const actualFile = require.resolve("braces", { paths: [path.dirname(micromatchFile)] });
const expectedFile = path.join(project, "node_modules", "braces", "index.js");
assert.equal(fs.realpathSync(actualFile), fs.realpathSync(expectedFile),
  "micromatch must load the locally reviewed braces version");
const braces = require(actualFile);
const micromatch = require("micromatch");

assert.equal(require(path.join(project, "node_modules", "braces", "package.json")).version, "3.0.3");

const archiveBytes = fs.readFileSync(path.join(project, "vendor", "braces-3.0.3.tgz"));
const expectedSRI = "sha512-" + crypto.createHash("sha512").update(archiveBytes).digest("base64");
const lock = JSON.parse(fs.readFileSync(path.join(project, "package-lock.json"), "utf8"));
assert.equal(lock.packages["node_modules/braces"].integrity, expectedSRI,
  "lockfile integrity must match the reviewed archive");

const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
// These are the exact files reviewed against the published upstream 3.0.3
// tarball. Do not regenerate hashes automatically during install or tests:
// a changed vendor file must trigger a fresh human source review.
const reviewedFileSha256 = Object.freeze({
  'LICENSE': '35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2',
  'README.md': '947b0fc3cc12eaaa070207126213fbdf9ab2bf8cd13dcc6e4007b36b79309866',
  'index.js': '332ea07c7b006361aad12aa994ca75dc1db8e8382b884909e2f38f10b85c88a4',
  'lib/compile.js': '2b416b149716dffd9b2813f8810c99681cff40d8f6e49e681e0f347c41360e42',
  'lib/constants.js': 'c18ac5adb57308f1ce42a28552da3a31f5d83709743ebd9a636336813a744d4b',
  'lib/expand.js': 'e6bf76b85dd3186b4ca47750d9f8c7fe57fd34cec942014a7db766a1357648bc',
  'lib/parse.js': '278f5fa2cc4a92719ec9708631eb69d3210c480017421c17ef90987f1a5456fd',
  'lib/stringify.js': '2e544adb0c17461e2e5cd727d464e6715f01d102efb8fad93b23d6a37e062c28',
  'lib/utils.js': 'bb2564bdad8f5fe6e6c7c4310944084c84a05a75285505dfe99f98b4e718f697',
  'package.json': '56f08b888a4f30dc7cf8a7dbb36ffe92b737912ba36abe9d069d32167c957ac7'
});
const vendoredRoot = path.join(project, "vendor", "braces");
const installedRoot = path.join(project, "node_modules", "braces");
function includedFiles(root) {
  const walk = (dir, prefix = "") => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory()
      ? walk(path.join(dir, entry.name), path.join(prefix, entry.name))
      : [path.join(prefix, entry.name)]);
  return walk(root).sort();
}
assert.deepEqual(includedFiles(vendoredRoot), Object.keys(reviewedFileSha256).sort(),
  "vendor source file set changed since security review");
assert.deepEqual(includedFiles(installedRoot), Object.keys(reviewedFileSha256).sort(),
  "installed braces file set changed since security review");
for (const [file, expected] of Object.entries(reviewedFileSha256)) {
  assert.equal(sha(path.join(vendoredRoot, file)), expected,
    "vendor file changed since security review: " + file);
  assert.equal(sha(path.join(installedRoot, file)), expected,
    "installed dependency differs from reviewed file: " + file);
}

assert.deepEqual(braces("file/{a,b}.js"), ["file/(a|b).js"]);
assert.deepEqual(braces.expand("file/{a,b}.js"), ["file/a.js", "file/b.js"]);
assert.deepEqual(micromatch(["src/a.test.ts", "src/a.spec.ts", "src/a.ts"],
  ["src/*.{test,spec}.ts"]), ["src/a.test.ts", "src/a.spec.ts"]);
assert.equal(braces.stringify("src/{a,b}.ts"), "src/{a,b}.ts");
assert.equal(braces.stringify("{1..3}", { escapeInvalid: true }), "{1..3}");
assert.equal(braces.stringify("{}", { escapeInvalid: true }), "{}");
assert.equal(braces.stringify("{x}", { escapeInvalid: true }), "{x}");


const pathologicalBraces = "{".repeat(160) + "a,b" + "}".repeat(160);
const pathologicalParens = "(".repeat(160) + "a" + ")".repeat(160);
for (const test of [
  () => braces(pathologicalBraces),
  () => braces.expand(pathologicalBraces),
  () => braces.stringify(pathologicalBraces),
  () => braces.parse(pathologicalBraces),
  () => braces(pathologicalParens),
]) {
  assert.throws(test, { name: "RangeError", message: /maximum AST nesting exceeded/ });
}

// Stress the exact advisory shape near the original 10,000-character input
// cap; the 128-level policy must stop it before a native stack overflow.
for (const nesting of [512, 4000]) {
  const veryDeepBraces = "{".repeat(nesting) + "x,y" + "}".repeat(nesting);
  const veryDeepParens = "(".repeat(nesting) + "x" + ")".repeat(nesting);
  for (const payload of [veryDeepBraces, veryDeepParens]) {
    assert.throws(() => braces.parse(payload),
      { name: "RangeError", message: /maximum AST nesting exceeded/ });
  }
}

let deepAst = { type: "text", value: "leaf" };
for (let i = 0; i < 160; i++) deepAst = { type: "root", nodes: [deepAst] };
for (const test of [
  () => braces.compile(deepAst),
  () => braces.expand(deepAst),
  () => braces.stringify(deepAst),
]) {
  assert.throws(test, { name: "RangeError", message: /maximum AST nesting exceeded/ });
}

let nestedArrays = ["safe"];
for (let i = 0; i < 160; i++) nestedArrays = [nestedArrays];
const utils = require(path.join(project, "node_modules/braces/lib/utils.js"));
assert.throws(() => utils.flatten(nestedArrays), { name: "RangeError", message: /maximum flatten nesting exceeded/ });

// Shallow concatenation is a separate resource-exhaustion surface from
// recursion depth. This bound must apply even if rangeLimit is disabled.
assert.equal(braces.expand("{a,b}".repeat(16)).length, 65536);
assert.throws(() => braces.expand("{a,b}".repeat(17)),
  { name: "RangeError", message: /maximum expansion results exceeded/ });
for (const n of [65537, 70000]) {
  assert.throws(() => braces.expand("{1.." + n + "}", { rangeLimit: false }),
    { name: "RangeError", message: /maximum expansion results exceeded/ });
}
assert.throws(() => utils.flatten(Array.from({ length: 65537 }, () => "a")),
  { name: "RangeError", message: /maximum expansion results exceeded/ });

const normalNested = "{".repeat(12) + "a,b" + "}".repeat(12);
assert.equal(typeof braces(normalNested)[0], "string");

console.log("PASS: installed braces matches local MIT-patched source, micromatch uses it, normal globs work and pathological nested AST paths fail safely");
