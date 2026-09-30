import type {
  CampaignDTO,
  CampaignStatus,
  IsoDateTime,
} from "@/types";

export interface CampaignFormValues {
  storeId: string;
  name: string;
  openAt: string;
  closeAt: string;
  paymentDeadline: string;
  pickupAt: string;
}

export interface CampaignFormErrors {
  storeId?: string;
  name?: string;
  openAt?: string;
  closeAt?: string;
  paymentDeadline?: string;
  pickupAt?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function isoUtcToLocalDateTimeInput(
  value: IsoDateTime | null,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function parseOptionalLocalDateTime(
  value: string,
  fieldLabel: string,
): { value: IsoDateTime | null; error?: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null };
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return {
      value: null,
      error: `${fieldLabel} ไม่ใช่วันเวลาที่ถูกต้อง`,
    };
  }

  return { value: parsed.toISOString() };
}

export function validateCampaignForm(
  values: CampaignFormValues,
): {
  values: {
    storeId: string;
    name: string;
    openAt: IsoDateTime | null;
    closeAt: IsoDateTime | null;
    paymentDeadline: IsoDateTime | null;
    pickupAt: IsoDateTime | null;
  } | null;
  errors: CampaignFormErrors;
  valid: boolean;
} {
  const storeId = values.storeId.trim();
  const name = values.name.trim();
  const errors: CampaignFormErrors = {};

  if (!storeId) {
    errors.storeId = "กรุณาเลือกร้านค้า";
  }

  if (!name) {
    errors.name = "กรุณาระบุชื่อ Campaign";
  }

  const openAt = parseOptionalLocalDateTime(
    values.openAt,
    "วันเวลาเปิด",
  );
  const closeAt = parseOptionalLocalDateTime(
    values.closeAt,
    "วันเวลาปิด",
  );
  const paymentDeadline = parseOptionalLocalDateTime(
    values.paymentDeadline,
    "กำหนดชำระเงิน",
  );
  const pickupAt = parseOptionalLocalDateTime(
    values.pickupAt,
    "วันเวลารับสินค้า",
  );

  if (openAt.error) errors.openAt = openAt.error;
  if (closeAt.error) errors.closeAt = closeAt.error;
  if (paymentDeadline.error) {
    errors.paymentDeadline = paymentDeadline.error;
  }
  if (pickupAt.error) errors.pickupAt = pickupAt.error;

  if (
    openAt.value &&
    closeAt.value &&
    Date.parse(openAt.value) >= Date.parse(closeAt.value)
  ) {
    errors.closeAt = "วันเวลาปิดต้องอยู่หลังวันเวลาเปิด";
  }

  if (
    openAt.value &&
    paymentDeadline.value &&
    Date.parse(paymentDeadline.value) < Date.parse(openAt.value)
  ) {
    errors.paymentDeadline =
      "กำหนดชำระเงินต้องไม่อยู่ก่อนวันเวลาเปิด";
  }

  if (
    closeAt.value &&
    pickupAt.value &&
    Date.parse(pickupAt.value) < Date.parse(closeAt.value)
  ) {
    errors.pickupAt =
      "วันเวลารับสินค้าต้องไม่อยู่ก่อนวันเวลาปิด";
  }

  if (Object.keys(errors).length > 0) {
    return {
      values: null,
      errors,
      valid: false,
    };
  }

  return {
    values: {
      storeId,
      name,
      openAt: openAt.value,
      closeAt: closeAt.value,
      paymentDeadline: paymentDeadline.value,
      pickupAt: pickupAt.value,
    },
    errors: {},
    valid: true,
  };
}

export function campaignToFormValues(
  campaign: CampaignDTO,
): CampaignFormValues {
  return {
    storeId: campaign.storeId,
    name: campaign.name,
    openAt: isoUtcToLocalDateTimeInput(campaign.openAt),
    closeAt: isoUtcToLocalDateTimeInput(campaign.closeAt),
    paymentDeadline: isoUtcToLocalDateTimeInput(
      campaign.paymentDeadline,
    ),
    pickupAt: isoUtcToLocalDateTimeInput(campaign.pickupAt),
  };
}

export function campaignStatusLabel(
  status: CampaignStatus,
): string {
  switch (status) {
    case "DRAFT":
      return "ฉบับร่าง";
    case "OPEN":
      return "เปิดรับคำสั่งซื้อ";
    case "CLOSED":
      return "ปิดรับคำสั่งซื้อ";
    case "PRODUCING":
      return "กำลังผลิต";
    case "READY_FOR_PICKUP":
      return "พร้อมรับสินค้า";
    case "COMPLETED":
      return "เสร็จสิ้น";
    case "CANCELLED":
      return "ยกเลิก";
  }
}
