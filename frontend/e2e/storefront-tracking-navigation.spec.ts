import { expect, test } from "./support/qa-fixture";
import {
  establishSeedRoleSession,
  type SeedRole,
} from "./support/seed-auth";

test("anonymous tracking goes directly to Login, preserves returnTo through Register and browser history", async ({
  page,
}) => {
  await page.goto("/");

  const tracking = page.getByRole("link", { name: "ติดตามคำสั่งซื้อ" });
  await expect(tracking).toBeVisible();

  const trackingHref = await tracking.getAttribute("href");
  const loginUrl = new URL(trackingHref ?? "", "http://localhost:3000");
  expect(loginUrl.pathname).toMatch(/^\/login\/?$/);
  expect(loginUrl.searchParams.get("returnTo")).toBe("/my/orders/");

  await tracking.click();
  await expect(page).toHaveURL(/\/login\/\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/my/orders/",
  );
  await expect(
    page.getByRole("heading", { name: "เข้าสู่บัญชีของคุณ" }),
  ).toBeVisible();
  await expect(page.getByText("ทำรายการเดิมต่อได้ทันที")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "สมัครสมาชิก" }).click();
  await expect(page).toHaveURL(/\/register\//);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/my/orders/",
  );
  await expect(page.getByText("สมัครแล้วกลับไปทำรายการต่อ")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/login\//);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/my/orders/",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
  ).toBeVisible();

  // Deep links remain protected: the hero change does not relax access.
  await page.goto("/my/orders/");
  await expect(
    page.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ", level: 1 }),
  ).toBeVisible();
});

for (const role of [
  "customer",
  "staff",
  "organizationAdmin",
  "platformAdmin",
] as const satisfies readonly SeedRole[]) {
  test(`authenticated ${role} tracking opens My Orders without the login gate`, async ({
    context,
    page,
    request,
  }) => {
    await establishSeedRoleSession(context, request, role);
    await page.goto("/");

    const tracking = page.getByRole("link", { name: "ติดตามคำสั่งซื้อ" });
    await expect(tracking).toHaveAttribute("href", /\/my\/orders\/?$/);
    await tracking.click();

    await expect(page).toHaveURL(/\/my\/orders\/$/);
    await expect(
      page.getByRole("heading", { name: "คำสั่งซื้อของฉัน", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" }),
    ).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("link", { name: "ติดตามคำสั่งซื้อ" }),
    ).toHaveAttribute("href", /\/my\/orders\/?$/);

    await page.goForward();
    await expect(page).toHaveURL(/\/my\/orders\/$/);
  });
}
