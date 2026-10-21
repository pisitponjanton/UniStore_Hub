import { expect, test } from "@playwright/test";

import {
  establishSeedRoleSession,
  getSeedOrganizationId,
} from "./support/seed-auth";

test("sidebar stays at the selected lower menu item after navigation", async ({
  context,
  page,
  request,
}) => {
  await establishSeedRoleSession(context, request, "organizationAdmin");
  const organizationId = getSeedOrganizationId();
  await page.goto(`/org/dashboard/?organizationId=${organizationId}`);

  const navigation = page.getByRole("navigation", { name: "เมนูหลัก" });
  await expect(navigation).toBeVisible();
  const scrollBefore = await navigation.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(scrollBefore).toBeGreaterThan(0);

  await navigation.getByRole("link", { name: "ประวัติการทำรายการ" }).click();
  await expect(page).toHaveURL(/\/org\/audit\//);
  await expect(
    navigation.getByRole("link", { name: "ประวัติการทำรายการ" }),
  ).toHaveAttribute("aria-current", "page");
  await navigation.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

  const scrollAfter = await navigation.evaluate((element) => element.scrollTop);
  expect(scrollAfter).toBeGreaterThanOrEqual(scrollBefore - 5);
});
