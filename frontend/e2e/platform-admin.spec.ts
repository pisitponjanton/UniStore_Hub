import {
  expect,
  test,
  unexpectedDiagnostics,
} from "./support/qa-fixture";
import { apiJson } from "./support/customer-commerce-fixtures";
import {
  establishSeedRoleSession,
  getSeedRoleToken,
  LOCAL_SEED_ENTITY_IDS,
  LOCAL_SEED_USERS,
} from "./support/seed-auth";

test("Platform Admin can navigate Platform scope, read live summary counts, and remains outside Organization scope without membership", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  const platformToken = await getSeedRoleToken(
    request,
    "platformAdmin",
  );
  const summary = await apiJson<{
    organizationsByStatus: Record<string, number>;
    usersByStatus: Record<string, number>;
  }>(request, "/platform/summary", {
    token: platformToken,
    expectedStatus: 200,
  });

  await establishSeedRoleSession(
    context,
    request,
    "platformAdmin",
  );

  await page.goto("/platform/summary/");

  await expect(
    page.getByRole("heading", {
      name: "ภาพรวม Platform",
      level: 1,
    }),
  ).toBeVisible();

  for (const label of [
    "ภาพรวมระบบ",
    "หน่วยงาน",
    "ผู้ใช้",
  ]) {
    await expect(
      page.getByRole("link", {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }

  for (const label of [
    "หน้าร้านค้า",
    "คำสั่งซื้อของฉัน",
    "การแจ้งเตือน",
  ]) {
    await expect(
      page.getByRole("link", {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }

  await expect(
    page.getByRole("link", {
      name: "เปลี่ยนหน่วยงาน",
    }),
  ).toHaveCount(0);

  const organizationTotal = Object.values(
    summary.organizationsByStatus,
  ).reduce((total, value) => total + value, 0);
  const userTotal = Object.values(
    summary.usersByStatus,
  ).reduce((total, value) => total + value, 0);

  await expect(
    page
      .getByText("หน่วยงานทั้งหมด", { exact: true })
      .locator(".."),
  ).toContainText(organizationTotal.toLocaleString("th-TH"));
  await expect(
    page
      .getByText("ผู้ใช้ทั้งหมด", { exact: true })
      .locator(".."),
  ).toContainText(userTotal.toLocaleString("th-TH"));

  await page
    .getByRole("link", {
      name: "หน่วยงาน",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "จัดการหน่วยงาน",
      level: 1,
    }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "ผู้ใช้",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "ผู้ใช้ระดับ Platform",
      level: 1,
    }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "หน้าร้านค้า",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", {
      name: "ภาพรวมระบบ",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      name: "ผู้ใช้ระดับ Platform",
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "ภาพรวมระบบ",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "ภาพรวม Platform",
      level: 1,
    }),
  ).toBeVisible();

  await page.goto(
    `/org/dashboard/?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}`,
  );
  await expect(
    page.getByRole("heading", {
      name: "ไม่มีสิทธิ์เข้าถึง",
      level: 1,
    }),
  ).toBeVisible();

  await page.goto("/org/select/");
  await expect(
    page.getByRole("heading", {
      name: "เลือกหน่วยงานที่จะทำงาน",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("ยังไม่มีหน่วยงานที่เข้าถึงได้"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "ภาพรวมระบบ",
      exact: true,
    }),
  ).toBeVisible();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Platform Admin can approve then suspend a real pending Organization through confirmation dialogs", async ({
  context,
  page,
  request,
  qaEvents,
}, testInfo) => {
  const [organizationAdminToken, platformToken] =
    await Promise.all([
      getSeedRoleToken(request, "organizationAdmin"),
      getSeedRoleToken(request, "platformAdmin"),
    ]);

  const organizationName =
    `QA Platform Org ${Date.now()}-${testInfo.workerIndex}`;
  const organization = await apiJson<{
    organizationId: string;
    status: string;
  }>(request, "/organizations", {
    method: "POST",
    token: organizationAdminToken,
    data: {
      name: organizationName,
      description:
        "Disposable Platform Admin governance fixture",
    },
    expectedStatus: 201,
  });

  expect(organization.status).toBe("PENDING");

  await establishSeedRoleSession(
    context,
    request,
    "platformAdmin",
  );
  await page.goto("/platform/organizations/");

  let organizationRow = page
    .locator("article")
    .filter({ hasText: organizationName })
    .first();

  await expect(organizationRow).toBeVisible();
  await expect(organizationRow).toContainText("รออนุมัติ");
  await expect(
    organizationRow.getByRole("button", {
      name: "อนุมัติ",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    organizationRow.getByRole("button", {
      name: "ระงับหน่วยงาน",
      exact: true,
    }),
  ).toBeVisible();

  await organizationRow
    .getByRole("button", {
      name: "อนุมัติ",
      exact: true,
    })
    .click();

  let dialog = page.getByRole("dialog", {
    name: `อนุมัติ ${organizationName}?`,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "ยกเลิก",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);

  let authoritativeOrganization = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${organization.organizationId}`,
    {
      token: organizationAdminToken,
      expectedStatus: 200,
    },
  );
  expect(authoritativeOrganization.status).toBe("PENDING");

  await organizationRow
    .getByRole("button", {
      name: "อนุมัติ",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: `อนุมัติ ${organizationName}?`,
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันอนุมัติ",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      `อนุมัติหน่วยงาน ${organizationName} เรียบร้อยแล้ว`,
    ),
  ).toBeVisible();

  authoritativeOrganization = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${organization.organizationId}`,
    {
      token: organizationAdminToken,
      expectedStatus: 200,
    },
  );
  expect(authoritativeOrganization.status).toBe("ACTIVE");

  organizationRow = page
    .locator("article")
    .filter({ hasText: organizationName })
    .first();
  await expect(organizationRow).toContainText("ใช้งาน");
  await expect(
    organizationRow.getByRole("button", {
      name: "อนุมัติ",
      exact: true,
    }),
  ).toHaveCount(0);

  await organizationRow
    .getByRole("button", {
      name: "ระงับหน่วยงาน",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog", {
    name: `ระงับ ${organizationName}?`,
  });
  await dialog
    .getByRole("button", {
      name: "ยืนยันระงับ",
      exact: true,
    })
    .click();

  await expect(
    page.getByText(
      `ระงับหน่วยงาน ${organizationName} เรียบร้อยแล้ว`,
    ),
  ).toBeVisible();

  authoritativeOrganization = await apiJson<{
    status: string;
  }>(
    request,
    `/organizations/${organization.organizationId}`,
    {
      token: organizationAdminToken,
      expectedStatus: 200,
    },
  );
  expect(authoritativeOrganization.status).toBe("SUSPENDED");

  organizationRow = page
    .locator("article")
    .filter({ hasText: organizationName })
    .first();
  await expect(organizationRow).toContainText("ระงับ");
  await expect(
    organizationRow.getByText(
      "ไม่มี action เพิ่มเติมในสถานะนี้",
    ),
  ).toBeVisible();
  await expect(
    organizationRow.getByRole("button", {
      name: "ระงับหน่วยงาน",
      exact: true,
    }),
  ).toHaveCount(0);

  const summaryAfter = await apiJson<{
    organizationsByStatus: Record<string, number>;
  }>(request, "/platform/summary", {
    token: platformToken,
    expectedStatus: 200,
  });
  expect(
    summaryAfter.organizationsByStatus.SUSPENDED ?? 0,
  ).toBeGreaterThan(0);

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("Platform Admin Users surface is read-only and exposes persisted Platform role/status data", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  const platformToken = await getSeedRoleToken(
    request,
    "platformAdmin",
  );
  const users = await apiJson<{
    items: Array<{
      userId: string;
      email: string;
      status: string;
      platformRole: string | null;
    }>;
  }>(request, "/platform/users", {
    token: platformToken,
    expectedStatus: 200,
  });

  const seedAdmin = users.items.find(
    (user) =>
      user.email === LOCAL_SEED_USERS.platformAdmin,
  );
  expect(seedAdmin).toBeTruthy();
  expect(seedAdmin?.status).toBe("ACTIVE");
  expect(seedAdmin?.platformRole).toBe("PLATFORM_ADMIN");

  await establishSeedRoleSession(
    context,
    request,
    "platformAdmin",
  );
  await page.goto("/platform/users/");

  await expect(
    page.getByRole("heading", {
      name: "ผู้ใช้ระดับ Platform",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("รายการนี้เป็น read-only"),
  ).toBeVisible();

  const usersSection = page.getByRole("region", {
    name: "ผู้ใช้ทั้งหมด",
  });
  await expect(usersSection).toBeVisible();

  await expect(
    usersSection.locator("button"),
  ).toHaveCount(0);
  await expect(
    usersSection.locator("input, select, textarea"),
  ).toHaveCount(0);

  const platformAdminRow = page
    .locator("tr")
    .filter({
      hasText: LOCAL_SEED_USERS.platformAdmin,
    })
    .first();
  await expect(platformAdminRow).toContainText("ใช้งาน");
  await expect(platformAdminRow).toContainText(
    "Platform Admin",
  );

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});
