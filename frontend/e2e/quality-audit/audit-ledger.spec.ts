import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { scenarioCatalog, assertScenarioCatalog, canonicalStatuses } from "./scenario-catalog";
import { validateOutcome, writeActionLedger, type ActionOutcome } from "./result-ledger";

test("FE-UX-SCENARIOS: canonical state/permission fixtures are indexed and not falsely passed", async () => {
  expect(assertScenarioCatalog()).toBeGreaterThan(40);
  expect(canonicalStatuses.campaign).toContain("CANCELLED");
  expect(canonicalStatuses.payment).toEqual(["PENDING_REVIEW", "APPROVED", "REJECTED"]);
  expect(canonicalStatuses.pickup).toEqual(["READY", "RECEIVED"]);
  expect(new Set(scenarioCatalog.map(x => x.id)).size).toBe(scenarioCatalog.length);
  expect(scenarioCatalog.every(x => x.status === "NOT_TESTED")).toBe(true);
  expect(scenarioCatalog.find(x => x.id === "STATE-UI-503")?.fixtureMode).toBe("network-mock");
});

test("FE-UX-LEDGER: require concrete action evidence and preserve untested outcomes", async () => {
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8"));
  const runId = "uxqa-" + randomUUID();
  const entry: ActionOutcome = {
    actionId: baseline.actions[0].id, role: "guest", state: "loaded",
    viewport: "390x844", status: "NOT_TESTED", testRunId: runId,
    evidence: [], notes: "Phase 0 route visit is not proof this action works",
  };
  expect(() => validateOutcome(baseline, { ...entry, status: "PASS" })).toThrow();
  expect(() => validateOutcome(baseline, { ...entry, actionId: "unknown" })).toThrow();
  expect(() => validateOutcome(baseline, { ...entry, role: "platformAdmin" })).toThrow();
  await writeActionLedger(runId, [entry]);
  const saved = JSON.parse(await readFile("test-results/quality-audit/" + runId + "/action-outcomes.json", "utf8"));
  expect(saved.recordedActions).toBe(1);
  expect(saved.entries[0].status).toBe("NOT_TESTED");
  await expect(writeActionLedger(runId, [{ ...entry, status: "PASS", evidence: ["../../../outside.png"] }])).rejects.toThrow();
});
