import {
  expect,
  test,
  unexpectedDiagnostics,
} from "./support/qa-fixture";
import { establishSeedRoleSession } from "./support/seed-auth";

test("QA harness opens the real local frontend", async ({
  page,
  qaEvents,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/UniStore Hub/i);
  await expect(page.locator("body")).toBeVisible();

  expect(unexpectedDiagnostics(qaEvents)).toEqual([]);
});

test("QA harness can establish a seeded Customer browser session", async ({
  context,
  page,
  request,
  qaEvents,
}) => {
  await establishSeedRoleSession(context, request, "customer");

  await page.goto("/my/orders/");
  await expect(page).toHaveURL(/\/my\/orders\/$/);
  await expect(page.locator("main")).toBeVisible();

  const unexpected = unexpectedDiagnostics(
    qaEvents,
    (event) =>
      event.kind === "http-error" &&
      event.status === 404 &&
      event.url.includes("/favicon"),
  );

  expect(unexpected).toEqual([]);
});
