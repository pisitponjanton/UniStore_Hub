// Canonical domain tokens from docs/specs/00-shared-contracts.md.
// State fixtures are DECLARATIONS, not pre-existing real records.
// Scenario execution must use local response mocks or newly owned disposable IDs.
// Never transition any seeded campaign, order, payment, pickup or organization.
export const canonicalStatuses = {
  organization: ["PENDING", "ACTIVE", "SUSPENDED"],
  campaign: ["DRAFT", "OPEN", "CLOSED", "PRODUCING", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"],
  order: ["PENDING_PAYMENT", "PAYMENT_REVIEW", "PAID", "PAYMENT_REJECTED", "CONFIRMED", "IN_PRODUCTION", "READY_FOR_PICKUP", "RECEIVED", "CANCELLED"],
  payment: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
  pickup: ["READY", "RECEIVED"],
} as const;

export const sharedVisualStates = [
  "loaded", "loading", "empty", "no-match", "503", "timeout",
  "401", "403", "404", "invalid-input", "form-submitting",
  "form-success", "form-server-error", "dialog-open", "dialog-cancel",
  "dialog-pending", "dialog-error", "stale-409", "long-text",
  "mobile-320", "mobile-390", "tablet-768", "desktop-1440",
] as const;

export type Scenario = {
  id: string;
  route: string;
  role: string;
  entity: keyof typeof canonicalStatuses | "shared-ui";
  fixtureMode: "network-mock" | "owned-disposable";
  setup: string;
  status: "NOT_TESTED";
};

const statusRoute: Record<keyof typeof canonicalStatuses, { route: string; role: string; fixtureMode: Scenario["fixtureMode"] }> = {
  organization: { route: "/platform/organizations/", role: "platformAdmin", fixtureMode: "owned-disposable" },
  campaign: { route: "/org/campaigns/", role: "organizationAdmin", fixtureMode: "owned-disposable" },
  order: { route: "/my/order/", role: "customer", fixtureMode: "owned-disposable" },
  payment: { route: "/org/payments/", role: "staff", fixtureMode: "owned-disposable" },
  pickup: { route: "/org/pickups/", role: "staff", fixtureMode: "owned-disposable" },
};

export const scenarioCatalog: Scenario[] = [
  ...Object.entries(canonicalStatuses).flatMap(([entity, states]) =>
    states.map((entityStatus) => ({
      id: "STATE-" + entity.toUpperCase() + "-" + entityStatus,
      route: statusRoute[entity as keyof typeof canonicalStatuses].route,
      role: statusRoute[entity as keyof typeof canonicalStatuses].role,
      entity: entity as keyof typeof canonicalStatuses,
      fixtureMode: statusRoute[entity as keyof typeof canonicalStatuses].fixtureMode,
      setup: "Create uniquely named local-owned record, transition through legal backend state machine; never use seeded target record",
      status: "NOT_TESTED" as const,
    })),
  ),
  ...sharedVisualStates.map((state) => ({
    id: "STATE-UI-" + state,
    route: "all applicable routes",
    role: "authorized route role",
    entity: "shared-ui" as const,
    fixtureMode: "network-mock" as const,
    setup: "Intercept only target GET with deterministic response/delay or exercise safe local UI; preserve /me identity unless explicitly testing 401",
    status: "NOT_TESTED" as const,
  })),
];

export function assertScenarioCatalog() {
  const ids = new Set(scenarioCatalog.map(x => x.id));
  if (ids.size !== scenarioCatalog.length) throw Error("Duplicate scenario IDs");
  if (scenarioCatalog.some(x => x.status !== "NOT_TESTED")) throw Error("Do not infer state PASS");
  return scenarioCatalog.length;
}
