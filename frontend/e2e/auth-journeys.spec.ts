import {
  expect,
  test,
  unexpectedDiagnostics,
} from "./support/qa-fixture";
import {
  getSeedRoleCredentials,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

function expectNoUnexpectedDiagnostics(
  events: Parameters<typeof unexpectedDiagnostics>[0],
) {
  expect(unexpectedDiagnostics(events)).toEqual([]);
}

test("anonymous user can discover stores and navigate public Storefront routes", async ({
  page,
  qaEvents,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "เลือกซื้อจากร้านในมหาวิทยาลัย",
    }),
  ).toBeVisible();

  const storeLink = page
    .getByRole("link", { name: /Local Demo Store/ })
    .first();
  await expect(storeLink).toBeVisible();
  await storeLink.click();

  await expect(page).toHaveURL(
    new RegExp(
      `/stores/view/\\?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}&storeId=${LOCAL_SEED_ENTITY_IDS.storeId}`,
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Local Demo Store", level: 1 }),
  ).toBeVisible();

  const campaignLink = page
    .getByRole("link", { name: /Local Demo Campaign/ })
    .first();
  await expect(campaignLink).toBeVisible();
  await campaignLink.click();

  await expect(page).toHaveURL(
    new RegExp(
      `/campaigns/view/\\?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}&campaignId=${LOCAL_SEED_ENTITY_IDS.campaignId}`,
    ),
  );
  await expect(
    page.getByRole("heading", {
      name: "Local Demo Campaign",
      level: 1,
    }),
  ).toBeVisible();

  const productLink = page
    .getByRole("link", { name: /Local Demo Product/ })
    .first();
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page).toHaveURL(
    new RegExp(
      `/products/view/\\?organizationId=${LOCAL_SEED_ENTITY_IDS.organizationId}&productId=${LOCAL_SEED_ENTITY_IDS.productId}`,
    ),
  );
  await expect(
    page.getByRole("heading", {
      name: "Local Demo Product",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "เข้าสู่ระบบเพื่อสั่งซื้อ" }),
  ).toBeVisible();

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("anonymous protected route preserves return context through login and register", async ({
  page,
  qaEvents,
}) => {
  await page.goto("/my/orders/");

  await expect(
    page.getByRole("heading", {
      name: "กรุณาเข้าสู่ระบบ",
      level: 1,
    }),
  ).toBeVisible();

  const loginLink = page.locator('a[href^="/login/"]').first();
  await expect(loginLink).toBeVisible();
  await loginLink.click();

  await expect(page).toHaveURL(/\/login\//);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/my/orders/",
  );
  await expect(
    page.getByText("ทำรายการเดิมต่อได้ทันที"),
  ).toBeVisible();

  await page.getByRole("link", { name: "สมัครสมาชิก" }).click();

  await expect(page).toHaveURL(/\/register\//);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/my/orders/",
  );
  await expect(
    page.getByText("สมัครแล้วกลับไปทำรายการต่อ"),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "กลับไปหน้าที่กำลังใช้งาน" })
    .click();

  await expect(page).toHaveURL(/\/my\/orders\/$/);
  await expect(
    page.getByRole("heading", {
      name: "กรุณาเข้าสู่ระบบ",
      level: 1,
    }),
  ).toBeVisible();

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("login form exposes client validation, focused error summary, and password visibility control", async ({
  page,
  qaEvents,
}) => {
  let loginRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/auth/login")
    ) {
      loginRequests += 1;
    }
  });

  await page.goto("/login/");

  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  const summary = page.locator("#login-error-summary");
  await expect(summary).toBeFocused();
  await expect(page.locator("#login-email-error")).toHaveText(
    "กรุณากรอกอีเมล",
  );
  await expect(page.locator("#login-password-error")).toHaveText(
    "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์",
  );
  expect(loginRequests).toBe(0);

  await page.getByLabel("อีเมล").fill("not-an-email");
  await page.getByLabel("รหัสผ่าน").fill("short");

  await page
    .getByRole("button", { name: "แสดงรหัสผ่าน" })
    .click();
  await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "ซ่อนรหัสผ่าน" }).click();
  await expect(page.getByLabel("รหัสผ่าน")).toHaveAttribute(
    "type",
    "password",
  );

  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(summary).toBeFocused();
  await expect(page.locator("#login-email-error")).toHaveText(
    "รูปแบบอีเมลไม่ถูกต้อง",
  );
  await expect(page.locator("#login-password-error")).toHaveText(
    "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์",
  );
  expect(loginRequests).toBe(0);

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("register form validates all fields without sending an invalid request", async ({
  page,
  qaEvents,
}) => {
  let registerRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/auth/register")
    ) {
      registerRequests += 1;
    }
  });

  await page.goto("/register/");

  await page.getByRole("button", { name: "สร้างบัญชี" }).click();

  const summary = page.locator("#register-error-summary");
  await expect(summary).toBeFocused();
  await expect(page.locator("#register-name-error")).toHaveText(
    "กรุณากรอกชื่อ",
  );
  await expect(page.locator("#register-email-error")).toHaveText(
    "กรุณากรอกอีเมล",
  );
  await expect(page.locator("#register-password-error")).toHaveText(
    "รหัสผ่านต้องมีอย่างน้อย 8 ไบต์",
  );
  expect(registerRequests).toBe(0);

  await page.getByLabel("ชื่อที่แสดง").fill("QA User");
  await page.getByLabel("อีเมล").fill("invalid");
  await page.getByLabel("รหัสผ่าน").fill("tiny");
  await page.getByRole("button", { name: "สร้างบัญชี" }).click();

  await expect(summary).toBeFocused();
  await expect(page.locator("#register-email-error")).toHaveText(
    "รูปแบบอีเมลไม่ถูกต้อง",
  );
  expect(registerRequests).toBe(0);

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("seeded Customer can log in through the UI, restore the session, see authenticated entry state, and log out", async ({
  page,
  qaEvents,
}) => {
  const credentials = getSeedRoleCredentials("customer");

  await page.goto("/my/orders/");
  await page.locator('a[href^="/login/"]').first().click();

  await page.getByLabel("อีเมล").fill(credentials.email);
  await page.getByLabel("รหัสผ่าน").fill(credentials.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(page).toHaveURL(/\/my\/orders\/$/);
  await expect(
    page.getByRole("heading", {
      name: "คำสั่งซื้อของฉัน",
      level: 1,
    }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", {
      name: "คำสั่งซื้อของฉัน",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ออกจากระบบ" }),
  ).toBeVisible();

  await page.goto("/login/");
  await expect(
    page.getByRole("heading", {
      name: "คุณเข้าสู่ระบบอยู่แล้ว",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("อีเมล")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "คำสั่งซื้อของฉัน" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "คำสั่งซื้อของฉัน" })
    .click();
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "เข้าสู่ระบบ" }),
  ).toBeVisible();

  await page.goto("/my/orders/");
  await expect(
    page.getByRole("heading", {
      name: "กรุณาเข้าสู่ระบบ",
      level: 1,
    }),
  ).toBeVisible();

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("new Customer can register through the real backend and return to the protected destination", async ({
  page,
  qaEvents,
}, testInfo) => {
  const unique = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `qa-auth-${unique}@local.unistore.test`;
  const password = "qa-phase4-pass";

  await page.goto(
    "/register/?returnTo=%2Fmy%2Forders%2F",
  );

  await page.getByLabel("ชื่อที่แสดง").fill("QA Phase 4");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "สร้างบัญชี" }).click();

  await expect(page).toHaveURL(/\/my\/orders\/$/);
  await expect(
    page.getByRole("heading", { name: "คำสั่งซื้อของฉัน", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ยังไม่มีคำสั่งซื้อ", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ออกจากระบบ" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "ออกจากระบบ" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/$/);

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("unsafe external auth return path is sanitized back to the Storefront", async ({
  page,
  qaEvents,
}) => {
  await page.goto(
    "/login/?returnTo=https%3A%2F%2Fevil.example%2Fphish",
  );

  const back = page.getByRole("link", {
    name: "กลับหน้าร้านค้า",
  });
  await expect(back).toHaveAttribute("href", "/");

  const register = page.getByRole("link", {
    name: "สมัครสมาชิก",
  });
  await expect(register).toHaveAttribute("href", "/register/");

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("public navigation remains reachable at a 375px mobile viewport", async ({
  page,
  qaEvents,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "UniStore Hub หน้าร้าน" }),
  ).toBeVisible();
  // The dedicated "ร้านค้า" nav item is intentionally hidden <= 620px;
  // the brand remains the mobile home/storefront affordance.
  await expect(
    page.getByRole("link", { name: "ร้านค้า" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "เข้าสู่ระบบ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "สมัครสมาชิก" }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("link", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  await expect(
    page.getByRole("link", { name: "กลับหน้าร้านค้า" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "กลับหน้าร้านค้า" })
    .click();

  await page.getByRole("link", { name: "สมัครสมาชิก" }).click();
  await expect(page).toHaveURL(/\/register\/$/);
  await expect(
    page.getByRole("link", { name: "กลับหน้าร้านค้า" }),
  ).toBeVisible();

  expectNoUnexpectedDiagnostics(qaEvents);
});

test("auth forms show their first field without scrolling at mobile and tablet widths", async ({
  page,
}) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    for (const [route, fieldId] of [["/login/", "login-email"], ["/register/", "register-name"]] as const) {
      await page.goto(route);
      const field = page.locator(`#${fieldId}`);
      await expect(field).toBeVisible();
      const box = await field.boundingBox();
      expect(box).not.toBeNull();
      if (box && width <= 820) {
        expect(box.y, `${route} first field must start on-screen at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${route} first field must fit within ${width}x${height}`).toBeLessThanOrEqual(height);
      }
      const overflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        document.documentElement.clientWidth,
      );
      expect(overflow, `${route} must not overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
