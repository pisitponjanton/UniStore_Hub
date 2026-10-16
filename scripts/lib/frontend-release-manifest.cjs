#!/usr/bin/env node
// Offline manifest for a copied public Frontend static-export release.
// No AWS calls. Store outside the asset root being hashed.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function inventory(root) {
  const base = path.resolve(root);
  if (!fs.statSync(base).isDirectory()) throw Error('Asset root must be a directory');
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
        throw Error('Unsupported asset entry (symlink/special file)');
      }
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else {
        const relative = path.relative(base, absolute).split(path.sep).join('/');
        const data = fs.readFileSync(absolute);
        files.push({
          path: relative,
          bytes: data.length,
          sha256: crypto.createHash('sha256').update(data).digest('hex'),
        });
      }
    }
  }
  visit(base);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function writeManifest(root, destination) {
  const file = path.resolve(destination);
  const base = path.resolve(root);
  if (file === base || file.startsWith(base + path.sep)) {
    throw Error('Manifest must not reside inside asset root');
  }
  const manifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    fileCount: 0,
    files: inventory(base),
  };
  manifest.fileCount = manifest.files.length;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  return manifest;
}

function verifyManifest(root, manifestPath) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (m.schemaVersion !== 1 || !Array.isArray(m.files) || m.fileCount !== m.files.length) {
    throw Error('Invalid frontend release manifest schema');
  }
  const actual = inventory(root);
  if (JSON.stringify(actual) !== JSON.stringify(m.files)) {
    throw Error('Frontend release differs from recorded manifest');
  }
  return m;
}

if (require.main === module) {
  const [command, root, file] = process.argv.slice(2);
  if (!['create', 'verify'].includes(command) || !root || !file) {
    console.error('Usage: node frontend-release-manifest.cjs create|verify <asset-root> <manifest.json>');
    process.exit(2);
  }
  try {
    const m = command === 'create'
      ? writeManifest(root, file)
      : verifyManifest(root, file);
    console.log('Frontend release manifest ' + command + ': ' + m.fileCount + ' files verified');
  } catch (error) {
    console.error('Frontend release manifest ' + command + ' failed: ' + error.message);
    process.exit(1);
  }
}

module.exports = { inventory, writeManifest, verifyManifest };
