import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.E2E_FRONTEND_BASE_URL ?? "http://localhost:3000";
const apiBaseURL =
  process.env.E2E_API_BASE_URL ??
  "http://localhost:4000/api/v1";

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

const usesNonLocalTarget =
  !isLoopbackUrl(baseURL) || !isLoopbackUrl(apiBaseURL);

if (usesNonLocalTarget) {
  const targetEnvironment = process.env.E2E_TARGET_ENV;
  const allowsMutations =
    process.env.E2E_ALLOW_NON_LOCAL_MUTATIONS === "true";

  if (
    targetEnvironment !== "integration" ||
    !allowsMutations
  ) {
    throw new Error(
      [
        "Refusing to run the mutating E2E suite against a non-local target.",
        "Non-local execution is supported only for disposable integration environments.",
        "Set E2E_TARGET_ENV=integration and E2E_ALLOW_NON_LOCAL_MUTATIONS=true explicitly.",
        "Production targets are not supported.",
      ].join(" "),
    );
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The integration suite shares deterministic seeded accounts and a
  // stateful backend, so serialize files to avoid cross-journey interference.
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
