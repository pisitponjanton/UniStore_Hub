/**
 * Phase 0 UXQA fixture safety utilities. No credential or network operations.
 * Ownership is explicit and scoped to the current test run; never modify seed IDs.
 * The browser read-only harness blocks ALL write methods separately.
 */
import { randomUUID } from "node:crypto";
import { LOCAL_SEED_ENTITY_IDS } from "../support/seed-auth";
const seedIds = new Set<string>(Object.values(LOCAL_SEED_ENTITY_IDS));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Kind = "user" | "organization" | "store" | "product" | "variant" | "campaign" | "order" | "payment" | "pickup";
export type JournalEntry = { action: string; kind: Kind; id: string; note: string };

export function assertLocalAuditTargets(frontendUrl: string, apiUrl: string) {
  for (const value of [frontendUrl, apiUrl]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        || url.username || url.password) {
      throw new Error("UXQA forbids remote or production target");
    }
  }
}
export function localAuditTargets() {
  const frontend = process.env.E2E_FRONTEND_BASE_URL ?? "http://localhost:3000";
  const api = process.env.E2E_API_BASE_URL ?? "http://localhost:4000/api/v1";
  assertLocalAuditTargets(frontend, api);
  return { frontend, api };
}

export class FixtureRegistry {
  readonly runId: string;
  private owned = new Map<Kind, Set<string>>();
  readonly journal: JournalEntry[] = [];
  constructor(runId = "UXQA-" + randomUUID()) {
    if (!/^UXQA-[0-9a-f-]{36}$/i.test(runId)) throw Error("Unsafe run ID");
    this.runId = runId;
  }
  label(name: string) {
    if (!/^[a-z0-9-]{1,30}$/i.test(name)) throw Error("Unsafe fixture label");
    return this.runId + "-" + name;
  }
  // Call this only AFTER receiving a creation response from a local test request
  // and verifying the submitted name/email included the current run marker.
  registerCreated(kind: Kind, id: string, creationLabel: string) {
    if (!uuid.test(id) || seedIds.has(id)) throw Error("Cannot claim seed/invalid ID");
    if (!creationLabel.startsWith(this.runId + "-")) throw Error("Creation marker missing");
    if (!this.owned.has(kind)) this.owned.set(kind, new Set());
    if (this.owned.get(kind)!.has(id)) throw Error("ID already registered");
    this.owned.get(kind)!.add(id);
    this.journal.push({ action: "created", kind, id, note: creationLabel });
  }
  owns(kind: Kind, id: string) { return this.owned.get(kind)?.has(id) ?? false; }
  requireOwned(kind: Kind, id: string) {
    if (!this.owns(kind, id)) throw Error("Cannot mutate unowned " + kind);
  }
  recordTransition(kind: Kind, id: string, action: string) {
    this.requireOwned(kind, id);
    this.journal.push({ action: "transition", kind, id, note: action });
  }
  retainedRecords() {
    // Do not blindly DELETE append-only/audited domain entities.
    return [...this.owned.entries()].flatMap(([kind, ids]) => [...ids].map(id => ({
      action: "retained-for-local-cleanup", kind, id, note: this.runId,
    })));
  }
}
export function assertOwnedMutation(registry: FixtureRegistry, urlText: string, method: string, kind: Kind, id: string) {
  const { api } = localAuditTargets();
  const requested = new URL(urlText);
  const expected = new URL(api);
  if (requested.origin !== expected.origin
    || !requested.pathname.startsWith(expected.pathname.replace(/\/$/, "") + "/")) {
    throw Error("Mutation outside local API");
  }
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method.toUpperCase())) throw Error("Not a mutation");
  registry.requireOwned(kind, id);
  if (!requested.pathname.split("/").includes(id)) throw Error("Mutation URL does not identify the owned record");
}
export function blockBrowserApiWrites(apiUrl: string) {
  // Reject even configuration of a remote API. Block ALL browser writes, including uploads.
  assertLocalAuditTargets("http://localhost:3000", apiUrl);
  return (_urlText: string, method: string) =>
    !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
