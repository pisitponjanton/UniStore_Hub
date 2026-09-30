import { describe, expect, it } from "vitest";

import {
  normalizeCampaignId,
  productionHref,
} from "./production-helpers";

describe("production helpers", () => {
  it("builds the static-export production route with optional Campaign context", () => {
    expect(productionHref("org 1")).toBe(
      "/org/production/?organizationId=org+1",
    );
    expect(productionHref("org 1", " campaign 1 ")).toBe(
      "/org/production/?organizationId=org+1&campaignId=campaign+1",
    );
  });

  it("normalizes optional campaign IDs without inventing a default", () => {
    expect(normalizeCampaignId(" campaign-1 ")).toBe(
      "campaign-1",
    );
    expect(normalizeCampaignId("   ")).toBeNull();
    expect(normalizeCampaignId(null)).toBeNull();
  });
});
