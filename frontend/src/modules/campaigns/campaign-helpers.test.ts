import { describe, expect, it } from "vitest";

import type { CampaignDTO } from "@/types";

import {
  campaignStatusLabel,
  campaignToFormValues,
  validateCampaignForm,
} from "./campaign-helpers";

const campaign: CampaignDTO = {
  campaignId: "campaign-1",
  organizationId: "org-1",
  storeId: "store-1",
  name: "Faculty Shirt Pre-order",
  openAt: "2026-10-01T00:00:00.000Z",
  closeAt: "2026-10-10T23:59:59.000Z",
  paymentDeadline: "2026-10-11T23:59:59.000Z",
  pickupAt: "2026-10-25T09:00:00.000Z",
  status: "DRAFT",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};

describe("campaign helpers", () => {
  it("serializes local datetime inputs to ISO UTC and normalizes text", () => {
    const result = validateCampaignForm({
      storeId: " store-1 ",
      name: " Faculty Campaign ",
      openAt: "2026-10-01T09:00",
      closeAt: "2026-10-10T18:00",
      paymentDeadline: "2026-10-11T18:00",
      pickupAt: "2026-10-25T09:00",
    });

    expect(result.valid).toBe(true);
    expect(result.values).toEqual({
      storeId: "store-1",
      name: "Faculty Campaign",
      openAt: new Date("2026-10-01T09:00").toISOString(),
      closeAt: new Date("2026-10-10T18:00").toISOString(),
      paymentDeadline: new Date(
        "2026-10-11T18:00",
      ).toISOString(),
      pickupAt: new Date("2026-10-25T09:00").toISOString(),
    });
  });

  it("keeps optional planning timestamps nullable", () => {
    expect(
      validateCampaignForm({
        storeId: "store-1",
        name: "Draft without schedule",
        openAt: "",
        closeAt: "",
        paymentDeadline: "",
        pickupAt: "",
      }),
    ).toEqual({
      values: {
        storeId: "store-1",
        name: "Draft without schedule",
        openAt: null,
        closeAt: null,
        paymentDeadline: null,
        pickupAt: null,
      },
      errors: {},
      valid: true,
    });
  });

  it("enforces only the documented campaign date relationships", () => {
    const result = validateCampaignForm({
      storeId: "store-1",
      name: "Invalid dates",
      openAt: "2026-10-10T10:00",
      closeAt: "2026-10-10T09:00",
      paymentDeadline: "2026-10-10T08:00",
      pickupAt: "2026-10-10T08:30",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({
      closeAt: "วันเวลาปิดต้องอยู่หลังวันเวลาเปิด",
      paymentDeadline:
        "กำหนดชำระเงินต้องไม่อยู่ก่อนวันเวลาเปิด",
      pickupAt:
        "วันเวลารับสินค้าต้องไม่อยู่ก่อนวันเวลาปิด",
    });
  });

  it("converts CampaignDTO timestamps back to local form values and labels canonical statuses", () => {
    const values = campaignToFormValues(campaign);

    expect(new Date(values.openAt).getTime()).toBe(
      new Date(campaign.openAt!).getTime(),
    );
    expect(campaignStatusLabel("DRAFT")).toBe("ฉบับร่าง");
    expect(campaignStatusLabel("OPEN")).toBe("เปิดรับคำสั่งซื้อ");
    expect(campaignStatusLabel("PRODUCING")).toBe("กำลังผลิต");
    expect(campaignStatusLabel("READY_FOR_PICKUP")).toBe(
      "พร้อมรับสินค้า",
    );
    expect(campaignStatusLabel("CANCELLED")).toBe("ยกเลิก");
  });
});
