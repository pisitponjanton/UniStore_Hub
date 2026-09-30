import { describe, expect, it } from "vitest";

import {
  canOrganizationCancelOrder,
  organizationOrderHref,
  organizationOrdersHref,
} from "./organization-order-helpers";

describe("organization order helpers", () => {
  it("builds canonical static-export query routes", () => {
    expect(organizationOrdersHref("org 1")).toBe(
      "/org/orders/?organizationId=org+1",
    );
    expect(
      organizationOrderHref("org 1", "order 1"),
    ).toBe(
      "/org/orders/view/?organizationId=org+1&orderId=order+1",
    );
  });

  it("allows cancellation only to Organization Admin in the two contract states", () => {
    expect(
      canOrganizationCancelOrder(
        "ORGANIZATION_ADMIN",
        "PENDING_PAYMENT",
      ),
    ).toBe(true);
    expect(
      canOrganizationCancelOrder(
        "ORGANIZATION_ADMIN",
        "PAYMENT_REJECTED",
      ),
    ).toBe(true);
    expect(
      canOrganizationCancelOrder("STAFF", "PENDING_PAYMENT"),
    ).toBe(false);
    expect(
      canOrganizationCancelOrder(
        "ORGANIZATION_ADMIN",
        "PAYMENT_REVIEW",
      ),
    ).toBe(false);
    expect(
      canOrganizationCancelOrder(
        "ORGANIZATION_ADMIN",
        "CANCELLED",
      ),
    ).toBe(false);
  });
});
