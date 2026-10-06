import type { TestInfo } from "@playwright/test";

import {
  expect,
  test,
  unexpectedDiagnostics,
} from "./support/qa-fixture";
import {
  apiJson,
  createReadyForPickupFixture,
  registerDisposableCustomer,
  tinyPng,
} from "./support/customer-commerce-fixtures";
import {
  createStaffPaymentReviewFixture,
  createStaffPendingOrderFixture,
} from "./support/staff-operational-fixtures";
import {
  createApprovedAdminOrganization,
  establishAdminOrganizationSession,
} from "./support/organization-admin-fixtures";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

async function recordFocusFinding({
  page,
  testInfo,
  summaryId,
  attachmentName,
  lines,
}: {
  page: import("@playwright/test").Page;
  testInfo: TestInfo;
  summaryId: string;
  attachmentName: string;
  lines: string[];
}) {
  const summary = page.locator(`#${summaryId}`);
  await expect(summary).toBeVisible();

  try {
    await expect(summary).toBeFocused();
  } catch (error) {
    await testInfo.attach(attachmentName, {
      body: Buffer.from(lines.join("\n")),
      contentType: "text/plain",
    });
    throw error;
  }
}

test("Organization Admin can use Dashboard and Settings, and Platform Admin routes stay forbidden", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createApprovedAdminOrganization(
    request,
    `settings-${Date.now()}-${testInfo.workerIndex}`,
  );
  const dashboardStore = await apiJson<{ storeId: string }>(
    request,
    `/organizations/${fixture.organizationId}/stores`,
    {
      method: "POST",
      token: fixture.adminToken,
      data: {
        name: `Dashboard Store ${Date.now()}`,
        description: "Dashboard filter fixture",
      },
      expectedStatus: 201,
    },
  );
  const dashboardCampaign = await apiJson<{ campaignId: string }>(
    request,
    `/organizations/${fixture.organizationId}/campaigns`,
    {
      method: "POST",
      token: fixture.adminToken,
      data: {
        storeId: dashboardStore.storeId,
        name: `Dashboard Campaign ${Date.now()}`,
        openAt: null,
        closeAt: null,
        paymentDeadline: null,
        pickupAt: null,
      },
      expectedStatus: 201,
    },
  );
  await establishAdminOrganizationSession(context, fixture);

  await page.goto(
    `/org/dashboard/?organizationId=${fixture.organizationId}`,
  );

  await expect(
    page.getByRole("heading", {
      name: "ภาพรวมหน่วยงาน",
      level: 1,
    }),
  ).toBeVisible();

  for (const label of [
    "แดชบอร์ด",
    "ข้อมูลหน่วยงาน",
    "บุคลากร",
    "ร้านค้า",
    "สินค้า",
    "แคมเปญ",
    "คำสั่งซื้อ",
    "ตรวจสอบการชำระเงิน",
    "รับสินค้า",
    "สรุปการผลิต",
    "ประวัติการทำรายการ",
  ]) {
    await expect(
      page.getByRole("link", {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }

  await page.locator("#dashboard-campaign-filter").fill(
    dashboardCampaign.campaignId,
  );
  await page.locator("#dashboard-store-filter").fill(
    dashboardStore.storeId,
  );
  await page.getByRole("button", { name: "ใช้ตัวกรอง" }).click();
  const dashboardScope = page.locator(
    '[aria-label="ขอบเขตรายงานที่ใช้อยู่"]',
  );
  await expect(dashboardScope).toContainText(
    dashboardCampaign.campaignId,
  );
  await expect(dashboardScope).toContainText(dashboardStore.storeId);
  await page
    .getByRole("button", { name: "แสดงทั้งหน่วยงาน" })
    .click();
  await expect(dashboardScope).toContainText("ทั้งหน่วยงาน");

  await page
    .getByRole("link", {
      name: "ตั้งค่าหน่วยงาน",
    })
    .click();

  await expect(page).toHaveURL(
    new RegExp("/org/settings/"),
  );
  await expect(
    page.locator("#organization-settings-name"),
  ).toHaveValue(fixture.organizationName);

  await page
    .locator("#organization-settings-name")
    .fill("");
  await page
    .getByRole("button", {
      name: "บันทึกการเปลี่ยนแปลง",
    })
    .click();

  await expect(
    page.locator("#organization-settings-name-error"),
  ).toHaveText("กรุณาระบุชื่อหน่วยงาน");

  await recordFocusFinding({
    page,
    testInfo,
    summaryId: "organization-settings-error-summary",
    attachmentName:
      "finding-phase7-settings-error-summary-focus",
    lines: [
      "P2 frontend finding candidate",
      "Route: /org/settings/",
      "Role: Organization Admin",
      "Action: clear Organization name and submit",
      "Expected: Error Summary receives focus",
      "Actual: validation renders but focus remains elsewhere",
    ],
  });

  const updatedName = `${fixture.organizationName} Updated`;
  await page
    .locator("#organization-settings-name")
    .fill(updatedName);
  await page
    .locator("#organization-settings-description")
    .fill("Updated by Organization Admin browser journey");
  await page
    .getByRole("button", {
      name: "บันทึกการเปลี่ยนแปลง",
    })
    .click();

  await expect(
    page.getByText("ข้อมูลหน่วยงานถูกอัปเดตเรียบร้อย"),
  ).toBeVisible();

  const organization = await apiJson<{
    name: string;
    description: string;
  }>(
    request,
    `/organizations/${fixture.organizationId}`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  expect(organization.name).toBe(updatedName);
  expect(organization.description).toBe(
    "Updated by Organization Admin browser journey",
  );

  for (const route of [
    "/platform/summary/",
    "/platform/organizations/",
    "/platform/users/",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", {
        name: "ไม่มีสิทธิ์เข้าถึง",
        level: 1,
      }),
    ).toBeVisible();
  }

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Organization Admin can manage members and Store lifecycle with confirmations", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createApprovedAdminOrganization(
    request,
    `staff-store-${Date.now()}-${testInfo.workerIndex}`,
  );
  const member = await registerDisposableCustomer(
    request,
    `admin-member-${Date.now()}-${testInfo.workerIndex}`,
  );
  await establishAdminOrganizationSession(context, fixture);

  await page.goto(
    `/org/staff/?organizationId=${fixture.organizationId}`,
  );

  await page
    .locator("#staff-email")
    .fill("invalid");
  await page
    .getByRole("button", {
      name: "เพิ่มสมาชิก",
    })
    .click();
  await expect(
    page.locator("#staff-email-error"),
  ).toHaveText("กรุณาระบุอีเมลที่ถูกต้อง");

  await recordFocusFinding({
    page,
    testInfo,
    summaryId: "staff-add-error-summary",
    attachmentName: "finding-phase7-staff-error-summary-focus",
    lines: [
      "P2 frontend finding candidate",
      "Route: /org/staff/",
      "Role: Organization Admin",
      "Action: submit invalid member email",
      "Expected: Error Summary receives focus",
      "Actual: validation renders but focus remains elsewhere",
    ],
  });

  await page.locator("#staff-email").fill(member.email);
  await page.locator("#staff-role").selectOption("STAFF");
  await page
    .getByRole("button", {
      name: "เพิ่มสมาชิก",
    })
    .click();

  await expect(
    page.getByText(
      `เพิ่ม ${member.email} เป็นบุคลากรแล้ว`,
    ),
  ).toBeVisible();

  let memberCard = page
    .locator("article")
    .filter({ hasText: member.email })
    .first();
  await expect(memberCard).toBeVisible();

  const roleSelect = memberCard.getByLabel("บทบาท");
  await roleSelect.selectOption("ORGANIZATION_ADMIN");
  await memberCard
    .getByRole("button", {
      name: "บันทึกบทบาท",
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: "ยืนยันการเปลี่ยนบทบาท",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันการเปลี่ยน",
    })
    .click();

  const roleFeedbackVisible = await page
    .getByText(/อัปเดตสิทธิ์ของ .* เป็น ผู้ดูแลหน่วยงาน แล้ว/)
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (!roleFeedbackVisible) {
    await testInfo.attach(
      "finding-phase7-staff-success-feedback-disappears",
      {
        body: Buffer.from(
          [
            "Regression: remediated P2 finding F-007-03",
            "Route: /org/staff/",
            "Action: confirm member role change",
          ].join("\n"),
        ),
        contentType: "text/plain",
      },
    );
  }
  expect(roleFeedbackVisible).toBe(true);
  memberCard = page
    .locator("article")
    .filter({ hasText: member.email })
    .first();
  await expect(
    memberCard.getByLabel("บทบาท"),
  ).toHaveValue("ORGANIZATION_ADMIN");
  await memberCard.getByLabel("บทบาท").selectOption("STAFF");
  await memberCard
    .getByRole("button", {
      name: "บันทึกบทบาท",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการเปลี่ยนบทบาท",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันการเปลี่ยน",
    })
    .click();

  memberCard = page
    .locator("article")
    .filter({ hasText: member.email })
    .first();
  await memberCard
    .getByRole("button", {
      name: "นำออก",
    })
    .click();

  dialog = page.getByRole("dialog", {
    name: "ยืนยันการนำสมาชิกออก",
  });
  await dialog
    .getByRole("button", {
      name: "นำออกจากหน่วยงาน",
    })
    .click();

  const removeFeedbackVisible = await page
    .getByText(/นำ .* ออกจากหน่วยงานแล้ว/)
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (!removeFeedbackVisible) {
    await testInfo.attach(
      "finding-phase7-staff-remove-success-feedback-disappears",
      {
        body: Buffer.from(
          [
            "Regression: remediated P2 finding F-007-03",
            "Route: /org/staff/",
            "Action: confirm member removal",
          ].join("\n"),
        ),
        contentType: "text/plain",
      },
    );
  }
  expect(removeFeedbackVisible).toBe(true);

  const membersAfterRemoval = await apiJson<{
    items: Array<{
      status: string;
      user: { email: string };
    }>;
  }>(
    request,
    `/organizations/${fixture.organizationId}/members`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  const removedMember = membersAfterRemoval.items.find(
    (item) => item.user.email === member.email,
  );
  expect(removedMember?.status).toBe("INACTIVE");

  await page.goto(
    `/org/stores/?organizationId=${fixture.organizationId}`,
  );

  await page
    .getByRole("button", {
      name: "สร้างร้านค้า",
    })
    .click();
  await expect(
    page.locator("#store-create-name-error"),
  ).toHaveText("กรุณาระบุชื่อร้านค้า");

  await recordFocusFinding({
    page,
    testInfo,
    summaryId: "store-create-error-summary",
    attachmentName: "finding-phase7-store-error-summary-focus",
    lines: [
      "P2 frontend finding candidate",
      "Route: /org/stores/",
      "Role: Organization Admin",
      "Action: submit empty Store form",
      "Expected: Error Summary receives focus",
      "Actual: validation renders but focus remains elsewhere",
    ],
  });

  const storeName = `QA Store ${Date.now()}`;
  await page.locator("#store-create-name").fill(storeName);
  await page
    .locator("#store-create-description")
    .fill("Admin browser Store");
  await page
    .getByRole("button", {
      name: "สร้างร้านค้า",
    })
    .click();

  await expect(
    page.getByText(`สร้างร้านค้า ${storeName} แล้ว`),
  ).toBeVisible();

  let storeCard = page
    .locator("article")
    .filter({ hasText: storeName })
    .first();
  await storeCard
    .getByRole("button", {
      name: "แก้ไขข้อมูล",
    })
    .click();

  const editedStoreName = `${storeName} Edited`;
  await page.locator("#store-edit-name").fill(editedStoreName);
  await page
    .getByRole("button", {
      name: "บันทึกข้อมูล",
    })
    .click();
  await expect(
    page.getByText(
      `บันทึกข้อมูลร้านค้า ${editedStoreName} แล้ว`,
    ),
  ).toBeVisible();

  storeCard = page
    .locator("article")
    .filter({ hasText: editedStoreName })
    .first();
  await storeCard
    .getByRole("button", {
      name: "ปิดใช้งาน",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการปิดใช้งานร้านค้า",
  });
  await dialog
    .getByRole("button", {
      name: "ปิดใช้งาน",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      `ปิดใช้งานร้านค้า ${editedStoreName} แล้ว`,
    ),
  ).toBeVisible();

  storeCard = page
    .locator("article")
    .filter({ hasText: editedStoreName })
    .first();
  const reopenStore = storeCard.getByRole("button", {
    name: "เปิดใช้งาน",
  });
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการเปิดใช้งานร้านค้า",
  });
  await reopenStore.click({ timeout: 1500 }).catch(async (error) => {
    if (!(await dialog.isVisible())) {
      throw error;
    }
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "เปิดใช้งาน",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      `เปิดใช้งานร้านค้า ${editedStoreName} แล้ว`,
    ),
  ).toBeVisible();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Organization Admin can create and manage Product, Variant, and Product image", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const fixture = await createApprovedAdminOrganization(
    request,
    `product-${Date.now()}-${testInfo.workerIndex}`,
  );

  const store = await apiJson<{ storeId: string; name: string }>(
    request,
    `/organizations/${fixture.organizationId}/stores`,
    {
      method: "POST",
      token: fixture.adminToken,
      data: {
        name: `Product Store ${Date.now()}`,
        description: "Store for Product admin journey",
      },
      expectedStatus: 201,
    },
  );

  await establishAdminOrganizationSession(context, fixture);
  await page.goto(
    `/org/products/?organizationId=${fixture.organizationId}`,
  );

  await page
    .getByRole("button", {
      name: "สร้างสินค้า",
    })
    .click();
  // With exactly one Store, the UI preselects it for faster creation.
  await expect(
    page.locator("#product-create-store"),
  ).toHaveValue(store.storeId);
  await expect(
    page.locator("#product-create-name-error"),
  ).toHaveText("กรุณาระบุชื่อสินค้า");

  await recordFocusFinding({
    page,
    testInfo,
    summaryId: "product-create-error-summary",
    attachmentName: "finding-phase7-product-error-summary-focus",
    lines: [
      "P2 frontend finding candidate",
      "Route: /org/products/",
      "Role: Organization Admin",
      "Action: submit empty Product form",
      "Expected: Error Summary receives focus",
      "Actual: validation renders but focus remains elsewhere",
    ],
  });

  const productName = `QA Product ${Date.now()}`;
  await page
    .locator("#product-create-store")
    .selectOption(store.storeId);
  await page.locator("#product-create-name").fill(productName);
  await page
    .locator("#product-create-description")
    .fill("Admin browser Product");
  await page
    .getByRole("button", {
      name: "สร้างสินค้า",
    })
    .click();

  await expect(
    page.getByText(`สร้างสินค้า ${productName} แล้ว`),
  ).toBeVisible();

  const productList = await apiJson<{
    items: Array<{
      productId: string;
      name: string;
    }>;
  }>(
    request,
    `/organizations/${fixture.organizationId}/products`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  const createdProduct = productList.items.find(
    (item) => item.name === productName,
  );
  expect(createdProduct).toBeTruthy();
  const productId = createdProduct!.productId;

  let productCard = page
    .locator("article")
    .filter({ hasText: productName })
    .first();
  await productCard
    .getByRole("button", {
      name: "แก้ไขข้อมูล",
    })
    .click();

  const editedProductName = `${productName} Edited`;
  await page.locator("#product-edit-name").fill(editedProductName);
  await page
    .getByRole("button", {
      name: "บันทึกข้อมูล",
    })
    .click();

  await expect(
    page.getByText(
      `บันทึกข้อมูลสินค้า ${editedProductName} แล้ว`,
    ),
  ).toBeVisible();

  const imageInput = page.locator(
    `#product-image-${productId}`,
  );
  await imageInput.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText(
      "รองรับเฉพาะ JPEG, PNG และ WebP",
    ),
  ).toBeVisible();

  await imageInput.setInputFiles({
    name: "admin-product.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page
    .getByRole("button", {
      name: "อัปโหลดรูปสินค้า",
    })
    .click();
  await expect(
    page.getByText(
      "อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว",
    ),
  ).toBeVisible({ timeout: 15_000 });

  const variantName = `Variant ${Date.now()}`;
  await page
    .locator(`#variant-create-name-${productId}`)
    .fill(variantName);
  await page
    .locator(`#variant-create-price-${productId}`)
    .fill("129.50");
  await page
    .getByRole("button", {
      name: "เพิ่มตัวเลือก",
    })
    .click();

  await expect(
    page.getByText(
      new RegExp(`สร้างตัวเลือก ${variantName} ราคา`),
    ),
  ).toBeVisible();

  let variantCard = page
    .locator("article")
    .filter({ hasText: variantName })
    .first();
  await variantCard
    .getByRole("button", {
      name: "แก้ไขตัวเลือก",
    })
    .click();

  const variantList = await apiJson<{
    variants: Array<{
      variantId: string;
      name: string;
    }>;
  }>(
    request,
    `/organizations/${fixture.organizationId}/products/${productId}`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  const variant = variantList.variants.find(
    (item) => item.name === variantName,
  );
  expect(variant).toBeTruthy();

  const variantId = variant!.variantId;
  const editedVariant = `${variantName} Edited`;
  await page
    .locator(`#variant-edit-name-${variantId}`)
    .fill(editedVariant);
  await page
    .locator(`#variant-edit-price-${variantId}`)
    .fill("149.75");
  await variantCard
    .getByRole("button", {
      name: "บันทึกตัวเลือก",
    })
    .click();

  await expect(
    page.getByText(
      new RegExp(`บันทึกตัวเลือก ${editedVariant} ราคา`),
    ),
  ).toBeVisible();

  variantCard = page
    .locator("article")
    .filter({ hasText: editedVariant })
    .first();
  await variantCard
    .getByRole("button", {
      name: "ปิดใช้งาน",
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: "ยืนยันการปิดใช้งานตัวเลือก",
  });
  await dialog
    .getByRole("button", {
      name: "ปิดใช้งานตัวเลือก",
    })
    .click();
  await expect(
    page.getByText(
      `ปิดใช้งานตัวเลือก ${editedVariant} แล้ว`,
    ),
  ).toBeVisible();

  productCard = page
    .locator("article")
    .filter({ hasText: editedProductName })
    .first();
  await productCard
    .getByRole("button", {
      name: "ปิดใช้งาน",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการปิดใช้งานสินค้า",
  });
  await dialog
    .getByRole("button", {
      name: "ปิดใช้งานสินค้า",
    })
    .click();

  await expect(
    page.getByText(
      `ปิดใช้งานสินค้า ${editedProductName} แล้ว`,
    ),
  ).toBeVisible();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Organization Admin can create a Campaign, move it through lifecycle states, load Production, and inspect Audit", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  test.setTimeout(70_000);

  const fixture = await createApprovedAdminOrganization(
    request,
    `campaign-${Date.now()}-${testInfo.workerIndex}`,
  );
  const store = await apiJson<{ storeId: string }>(
    request,
    `/organizations/${fixture.organizationId}/stores`,
    {
      method: "POST",
      token: fixture.adminToken,
      data: {
        name: `Campaign Store ${Date.now()}`,
        description: "Store for Campaign admin journey",
      },
      expectedStatus: 201,
    },
  );

  await establishAdminOrganizationSession(context, fixture);
  await page.goto(
    `/org/campaigns/?organizationId=${fixture.organizationId}`,
  );

  await page
    .getByRole("button", {
      name: "สร้างแคมเปญ",
    })
    .click();
  // With exactly one Store, the UI preselects it for faster creation.
  await expect(
    page.locator("#campaign-create-store"),
  ).toHaveValue(store.storeId);
  await expect(
    page.locator("#campaign-create-name-error"),
  ).toHaveText("กรุณาระบุชื่อ Campaign");
  await recordFocusFinding({
    page,
    testInfo,
    summaryId: "campaign-create-error-summary",
    attachmentName: "finding-phase7-campaign-error-summary-focus",
    lines: [
      "P2 frontend finding candidate",
      "Route: /org/campaigns/",
      "Role: Organization Admin",
      "Action: submit empty Campaign form",
      "Expected: Error Summary receives focus",
      "Actual: validation renders but focus remains elsewhere",
    ],
  });

  const campaignName = `QA Campaign ${Date.now()}`;
  await page
    .locator("#campaign-create-store")
    .selectOption(store.storeId);
  await page
    .locator("#campaign-create-name")
    .fill(campaignName);
  await page
    .locator("#campaign-create-open")
    .fill("2031-01-01T09:00");
  await page
    .locator("#campaign-create-close")
    .fill("2031-01-10T18:00");
  await page
    .locator("#campaign-create-payment")
    .fill("2031-01-11T18:00");
  await page
    .locator("#campaign-create-pickup")
    .fill("2031-01-20T09:00");

  await page
    .getByRole("button", {
      name: "สร้างแคมเปญ",
    })
    .click();
  await expect(
    page.getByText(
      `สร้างแคมเปญ ${campaignName} เป็นฉบับร่างแล้ว`,
    ),
  ).toBeVisible();

  const campaignList = await apiJson<{
    items: Array<{
      campaignId: string;
      name: string;
      status: string;
    }>;
  }>(
    request,
    `/organizations/${fixture.organizationId}/campaigns`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  const campaign = campaignList.items.find(
    (item) => item.name === campaignName,
  );
  expect(campaign).toBeTruthy();
  const campaignId = campaign!.campaignId;

  const card = page
    .locator("article")
    .filter({ hasText: campaignName })
    .first();
  await card
    .getByRole("button", {
      name: "ดูและแก้ไข",
    })
    .click();

  const editedCampaignName = `${campaignName} Edited`;
  await page
    .locator("#campaign-edit-name")
    .fill(editedCampaignName);
  await page
    .getByRole("button", {
      name: "บันทึกฉบับร่าง",
    })
    .click();
  await expect(
    page.getByText(
      `บันทึกแคมเปญ ${editedCampaignName} แล้ว`,
    ),
  ).toBeVisible();

  const lifecycle = [
    {
      action: "เปิดรับคำสั่งซื้อ",
      status: "เปิดรับคำสั่งซื้อ",
    },
    {
      action: "ปิดรับคำสั่งซื้อ",
      status: "ปิดรับคำสั่งซื้อ",
    },
    {
      action: "เริ่มการผลิต",
      status: "กำลังผลิต",
    },
    {
      action: "แจ้งพร้อมรับสินค้า",
      status: "พร้อมรับสินค้า",
    },
    {
      action: "ปิดแคมเปญเป็นเสร็จสิ้น",
      status: "เสร็จสิ้น",
    },
  ];

  for (const step of lifecycle) {
    await page
      .getByRole("button", {
        name: step.action,
        exact: true,
      })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", {
        name: step.action,
        exact: true,
      })
      .click();

    await expect(
      page.getByText(
        `สถานะเปลี่ยนเป็น “${step.status}” แล้ว`,
      ),
    ).toBeVisible();
  }

  const finalCampaign = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${fixture.organizationId}/campaigns/${campaignId}`,
    {
      token: fixture.adminToken,
      expectedStatus: 200,
    },
  );
  expect(finalCampaign.status).toBe("COMPLETED");

  await page.goto(
    `/org/production/?organizationId=${fixture.organizationId}`,
  );

  await page
    .locator("#production-campaign-id")
    .fill(campaignId);
  await page
    .getByRole("button", {
      name: "โหลดสรุปการผลิต",
    })
    .click();

  await expect(
    page.getByRole("region", {
      name: "สรุปจำนวนที่ต้องผลิต",
    }),
  ).toBeVisible();

  await page.goto(
    `/org/audit/?organizationId=${fixture.organizationId}`,
  );

  await page
    .locator("#audit-resource-id")
    .fill(campaignId);
  await page
    .getByRole("button", {
      name: "ค้นหา / กรอง",
    })
    .click();

  await expect(
    page.getByRole("group", {
      name: "ตัวกรองที่ใช้อยู่",
    }),
  ).toContainText(campaignId);

  const auditRows = page.locator("tbody tr");
  await expect(auditRows.first()).toBeVisible();
  await auditRows
    .first()
    .locator("details summary")
    .click();
  await expect(
    auditRows.first().locator("details"),
  ).toHaveAttribute("open", "");

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Organization Admin can perform Admin-only Order cancellation and use operational Payment/Pickup work", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  test.setTimeout(80_000);

  const pendingOrder = await createStaffPendingOrderFixture(
    request,
    `admin-order-${Date.now()}-${testInfo.workerIndex}`,
  );

  await establishSeedRoleSession(
    context,
    request,
    "organizationAdmin",
  );

  await page.goto(
    `/org/orders/view/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}&orderId=${pendingOrder.orderId}`,
  );

  await expect(
    page.getByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "ยกเลิกคำสั่งซื้อ",
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: "ยืนยันการยกเลิกคำสั่งซื้อ",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันยกเลิกคำสั่งซื้อ",
    })
    .click();

  await expect(
    page.getByText("ยกเลิกคำสั่งซื้อแล้ว"),
  ).toBeVisible();

  const paymentFixture =
    await createStaffPaymentReviewFixture(
      request,
      `admin-payment-${Date.now()}-${testInfo.workerIndex}`,
    );

  await page.goto(
    `/org/payments/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );
  await page
    .locator("#payment-review-order")
    .fill(paymentFixture.orderId);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const paymentRow = page.getByRole("article", {
    name: new RegExp(paymentFixture.paymentId),
  });
  await paymentRow
    .getByRole("button", {
      name: new RegExp("ตรวจสอบ การชำระเงิน"),
    })
    .click();

  await page
    .locator('aside[aria-label="รายละเอียดการชำระเงิน"]')
    .getByRole("button", {
      name: "อนุมัติการชำระเงิน",
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: "ยืนยันการอนุมัติการชำระเงิน",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันอนุมัติ",
    })
    .click();

  await expect(
    page.getByText(
      "อนุมัติการชำระเงินเรียบร้อยแล้ว",
    ),
  ).toBeVisible();

  const pickupFixture =
    await createReadyForPickupFixture(
      request,
      `admin-pickup-${Date.now()}-${testInfo.workerIndex}`,
    );

  await page.goto(
    `/org/pickups/?organizationId=${pickupFixture.organizationId}`,
  );
  await page
    .locator("#pickup-token-filter")
    .fill(pickupFixture.pickupToken);
  await page
    .getByRole("button", {
      name: "ใช้ตัวกรอง",
    })
    .click();

  const pickupRow = page.getByRole("article", {
    name: new RegExp(pickupFixture.pickupId),
  });
  await pickupRow
    .getByRole("button", {
      name: new RegExp("ดูรายละเอียด Pickup"),
    })
    .click();

  await page
    .locator('aside[aria-label="รายละเอียด Pickup"]')
    .getByRole("button", {
      name: "ยืนยันรับสินค้า",
    })
    .click();

  dialog = page.getByRole("dialog", {
    name: "ยืนยันการรับสินค้า",
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันรับสินค้า",
    })
    .click();

  await expect(
    page.getByText(
      "ยืนยันการรับสินค้าเรียบร้อยแล้ว",
    ),
  ).toBeVisible();

  const adminToken = await getSeedRoleToken(
    request,
    "organizationAdmin",
  );
  const receivedOrder = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${pickupFixture.organizationId}/orders/${pickupFixture.orderId}`,
    {
      token: adminToken,
      expectedStatus: 200,
    },
  );
  expect(receivedOrder.status).toBe("RECEIVED");

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});
