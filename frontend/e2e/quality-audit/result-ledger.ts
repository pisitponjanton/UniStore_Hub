/**
 * Evidence-backed outcome ledger for future UXQA implementation phases.
 * A route screenshot alone is not evidence that an Action works.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export type OutcomeStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_TESTED";
export type ActionOutcome = {
  actionId: string;
  role: string;
  state: string;
  viewport: string;
  status: OutcomeStatus;
  testRunId: string;
  evidence: string[];
  notes: string;
};
type BaselineAction = { id: string; roles: string[] };
type Baseline = { actions: BaselineAction[]; shellActions: BaselineAction[] };

export function validateOutcome(baseline: Baseline, entry: ActionOutcome) {
  const action = [...baseline.actions, ...baseline.shellActions].find(a => a.id === entry.actionId);
  if (!action) throw Error("Unknown action ID: " + entry.actionId);
  if (!action.roles.includes(entry.role)) throw Error("Wrong role for action: " + entry.actionId);
  if (!["PASS", "FAIL", "BLOCKED", "NOT_TESTED"].includes(entry.status)) throw Error("Unknown outcome");
  if (!/^[a-zA-Z0-9_-]{2,100}$/.test(entry.testRunId)) throw Error("Unsafe run ID");
  if (!entry.viewport || !entry.state) throw Error("Missing reproducibility context");
  if (!entry.notes?.trim()) throw Error("Outcome needs an explanation");
  if (["PASS", "FAIL"].includes(entry.status) && entry.evidence.length === 0) {
    throw Error("Cannot mark PASS/FAIL without current evidence");
  }
  if (entry.status === "NOT_TESTED" && entry.evidence.length !== 0) {
    throw Error("NOT_TESTED must not imply recorded execution");
  }
}

/** All paths are relative to the approved ignored test-results output tree. */
export async function writeActionLedger(runId: string, entries: ActionOutcome[], rootDir = "test-results/quality-audit") {
  if (!/^uxqa-[a-f0-9-]{36}$/i.test(runId)) throw Error("Invalid UXQA run ID");
  const baseline = JSON.parse(await readFile("quality-audit/coverage-baseline.json", "utf8")) as Baseline;
  const absoluteRoot = resolve(rootDir, runId);
  const unique = new Set<string>();
  for (const entry of entries) {
    validateOutcome(baseline, entry);
    if (entry.testRunId !== runId) throw Error("Mixed run IDs");
    const key = [entry.actionId, entry.role, entry.state, entry.viewport].join("|");
    if (unique.has(key)) throw Error("Conflicting/duplicate action result");
    unique.add(key);
    for (const name of entry.evidence) {
      if (isAbsolute(name)) throw Error("Absolute evidence path forbidden");
      const full = resolve(absoluteRoot, name);
      if (relative(absoluteRoot, full).startsWith("..") || relative(absoluteRoot, full) === "") {
        throw Error("Evidence must stay within this run directory");
      }
      await access(full);
    }
  }
  await mkdir(absoluteRoot, { recursive: true });
  await writeFile(join(absoluteRoot, "action-outcomes.json"), JSON.stringify({
    schemaVersion: 1, runId, recordedActions: entries.length, entries,
    policy: "Action PASS/FAIL requires concrete evidence; route visit alone does not count.",
  }, null, 2) + "\n");
}
