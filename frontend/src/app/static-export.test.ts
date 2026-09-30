import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

function findDynamicRouteDirectories(root: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = join(root, entry.name);

    if (/^\[.+\]$/.test(entry.name)) {
      found.push(fullPath);
    }

    found.push(...findDynamicRouteDirectories(fullPath));
  }

  return found;
}

describe("static export contract", () => {
  it("keeps Next.js configured for trailing-slash static export", () => {
    expect(nextConfig.output).toBe("export");
    expect(nextConfig.trailingSlash).toBe(true);
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it("uses query-based entity routes instead of runtime dynamic route directories", () => {
    expect(
      findDynamicRouteDirectories(join(process.cwd(), "src/app")),
    ).toEqual([]);
  });
});
