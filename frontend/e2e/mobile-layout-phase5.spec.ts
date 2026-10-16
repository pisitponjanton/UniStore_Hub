import { expect, test } from "./support/qa-fixture";
import {
  establishSeedRoleSession,
  LOCAL_SEED_ENTITY_IDS,
} from "./support/seed-auth";

// Read-only responsive regression: no Order, Payment, or Organization writes.
test("mobile storefront prioritizes a real store and searchable directory without clipping", async ({
  page,
}) => {
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", {
        name: "เลือกร้านจากพื้นที่ที่เปิดอยู่",
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('a[href*="/stores/view"]').first(),
    ).toBeVisible();

    const measured = await page.evaluate(() => {
      const at = (selector: string) => {
        const element = document.querySelector(selector);
        return element
          ? Math.round(element.getBoundingClientRect().top + scrollY)
          : null;
      };

      return {
        firstStoreY: at('a[href*="/stores/view"]'),
        catalogY: at("#storefront-heading"),
        guideY: at("#storefront-guide-heading"),
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        featuredVisible: Array.from(
          document.querySelectorAll<HTMLAnchorElement>(
            'a[class*="discoveryCard"]',
          ),
        ).filter((element) => getComputedStyle(element).display !== "none").length,
      };
    });

    expect(measured.pageOverflow).toBeLessThanOrEqual(1);
    expect(measured.firstStoreY).not.toBeNull();
    expect(measured.catalogY).not.toBeNull();
    expect(measured.firstStoreY!).toBeLessThanOrEqual(
      width <= 360 ? 1100 : 900,
    );
    expect(measured.catalogY!).toBeLessThanOrEqual(
      width <= 360 ? 1450 : 1280,
    );
    expect(measured.guideY!).toBeGreaterThan(measured.catalogY!);
    expect(measured.featuredVisible).toBe(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('a[href*="/stores/view"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("link", { name: "ดูร้านที่เปิดอยู่" }),
  ).toHaveAttribute("href", "#storefront-heading");
  await page.getByRole("searchbox", {
    name: "ค้นหาร้านค้าหรือหน่วยงาน",
  }).fill("zzzz_no_matching_store_phase5");
  await expect(
    page.getByText("ไม่พบร้านค้าหรือหน่วยงานที่ตรงกับการค้นหา"),
  ).toBeVisible();
  await page.getByRole("button", { name: "แสดงรายการทั้งหมด" }).click();
  await expect(page.locator('a[href*="/stores/view"]').first()).toBeVisible();
});

test("tablet and desktop retain original hero and featured store composition", async ({
  page,
}) => {
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "เลือกร้านจากพื้นที่ที่เปิดอยู่" }),
    ).toBeVisible({ timeout: 20_000 });
    const layout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('section[class*="hero"]');
      const art = document.querySelector<HTMLElement>('div[class*="heroScene"]');
      const guide = document.querySelector<HTMLElement>("#storefront-guide-heading");
      const featured = document.querySelector<HTMLElement>("#storefront-discovery-heading");
      const cards = Array.from(document.querySelectorAll<HTMLElement>(
        'a[class*="discoveryCard"]',
      ));
      return {
        heroArtVisible: art ? getComputedStyle(art).display !== "none" : false,
        guideY: guide ? guide.getBoundingClientRect().top : null,
        featuredY: featured ? featured.getBoundingClientRect().top : null,
        cardCount: cards.filter(card => getComputedStyle(card).display !== "none").length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        heroIsGrid: hero ? getComputedStyle(hero).display === "grid" : false,
      };
    });
    expect(layout.heroArtVisible).toBe(true);
    expect(layout.heroIsGrid).toBe(true);
    expect(layout.guideY!).toBeLessThan(layout.featuredY!);
    // Local Dev suppresses explicitly marked QA organizations by default;
    // the user can restore all four featured stores without modifying data.
    const showFixtures = page.getByRole("button", {
      name: /แสดงข้อมูล E2E\/QA/,
    });
    if (await showFixtures.count()) {
      expect(layout.cardCount).toBeGreaterThan(0);
      await showFixtures.click();
      await expect(page.locator('a[class*="discoveryCard"]')).toHaveCount(4);
    } else {
      expect(layout.cardCount).toBe(4);
    }
    expect(layout.overflow).toBeLessThanOrEqual(1);
  }
});

test("auth forms keep rotated artwork within their panel and remain accessible", async ({
  page,
}) => {
  for (const route of ["/login/", "/register/"]) {
    for (const width of [320, 390, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first()).toBeVisible({
        timeout: 20_000,
      });
      const containment = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(
          'div[class*="introBody"]',
        );
        const visual = document.querySelector<HTMLElement>(
          'div[class*="authVisual"]',
        );
        return {
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
          introOverflow: body && body.clientWidth > 0
            ? body.scrollWidth - body.clientWidth : 0,
          visualOverflow: visual && visual.clientWidth > 0
            ? visual.scrollWidth - visual.clientWidth : 0,
        };
      });
      expect(containment.documentOverflow).toBeLessThanOrEqual(1);
      expect(containment.introOverflow).toBeLessThanOrEqual(2);
      expect(containment.visualOverflow).toBeLessThanOrEqual(2);
    }
    await expect(page.locator("input").first()).toBeVisible();
  }
});

test("Audit table intentionally scrolls horizontally and supports keyboard navigation", async ({
  context,
  page,
  request,
}) => {
  await establishSeedRoleSession(context, request, "organizationAdmin");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(
    "/org/audit/?organizationId=" + LOCAL_SEED_ENTITY_IDS.organizationId,
    { waitUntil: "domcontentloaded" },
  );
  await expect(
    page.getByRole("heading", { name: "ประวัติการทำรายการ" }),
  ).toBeVisible({ timeout: 20_000 });
  // The 4-field filter must adapt to the *inner* width beside the sidebar.
  const filterGrid = page.locator('div[class*="filters"]').first();
  await expect(filterGrid).toBeVisible();
  const filterGeometry = await filterGrid.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
    overflow: element.scrollWidth - element.clientWidth,
  }));
  expect(filterGeometry.columns).toBe(2);
  expect(filterGeometry.overflow).toBeLessThanOrEqual(2);

  const table = page.locator('table').first();
  await expect(table).toBeVisible({ timeout: 20_000 });
  const frame = table.locator("xpath=..");
  const initial = await frame.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: styles.overflowX,
      tabIndex: (element as HTMLElement).tabIndex,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(initial.scrollWidth).toBeGreaterThan(initial.clientWidth);
  expect(initial.overflowX).toMatch(/auto|scroll/);
  expect(initial.tabIndex).toBe(0);
  expect(initial.documentOverflow).toBeLessThanOrEqual(1);
  await frame.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => frame.evaluate(el => el.scrollLeft), {
    timeout: 5_000,
  }).toBeGreaterThan(0);
});
