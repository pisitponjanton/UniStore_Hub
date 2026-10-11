import { expect, test } from "./support/qa-fixture";
import { LOCAL_SEED_ENTITY_IDS as seed } from "./support/seed-auth";

const productPath =
  `/products/view/?organizationId=${seed.organizationId}&productId=${seed.productId}`;

function contrastRatio(foreground: string, background: string): number {
  function luminance(rgb: string): number {
    const values = rgb.match(/[0-9.]+/g)?.slice(0, 3).map(Number) ?? [];
    if (values.length !== 3) {
      throw new Error(`Expected an opaque RGB color, got: ${rgb}`);
    }
    const linear = values.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }

  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("no-photo product preserves compact media, legible option label and purchase focus", async ({
  page,
}) => {
  await page.goto(productPath);
  await expect(page.locator("#product-quantity")).toBeVisible();

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });

    const layout = await page.locator('[data-has-image="false"][class*="productDetailMedia"]').evaluate(
      (element) => {
        const stage = element.getBoundingClientRect();
        const fallback = element.querySelector('[class*="productDetailPlaceholder"]');
        const label = fallback?.querySelector('[class*="mediaFallbackLabel"]');
        const bounds = label?.getBoundingClientRect();
        const step = document.querySelector('[class*="selectionStep"]');
        if (!bounds || !step) throw new Error("No-photo fallback or option summary missing");

        return {
          height: stage.height,
          labelVisible:
            bounds.top >= stage.top &&
            bounds.bottom <= stage.bottom &&
            bounds.left >= stage.left &&
            bounds.right <= stage.right,
          foreground: getComputedStyle(step).color,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      },
    );

    expect(layout.labelVisible).toBe(true);
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(layout.height).toBeLessThanOrEqual(width <= 900 ? 160 : 470);
    // Canonical v3 ink-secondary on surface-muted. No translucent decorative art
    // is used as the foreground text color.
    expect(contrastRatio(layout.foreground, "rgb(241, 238, 248)")).toBeGreaterThanOrEqual(4.5);
  }

  const variant = page.locator("#product-variant");
  await variant.focus();
  await expect(variant).toBeFocused();
  const focus = await variant.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { outline: styles.outlineStyle, width: styles.outlineWidth };
  });
  expect(focus.outline).toBe("solid");
  expect(focus.width).toBe("3px");

  await page.locator("#product-quantity").fill("2");
  await expect(page.locator("output")).toHaveText("฿398.00");
  await page.locator("#product-quantity").fill("0");
  await expect(page.getByText("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป")).toBeVisible();
});

test("real product imagery retains its full square gallery across screen sizes", async ({
  page,
}) => {
  await page.route(
    `**/api/v1/storefront/organizations/${seed.organizationId}/stores/${seed.storeId}/products/${seed.productId}`,
    async (route) => {
      const response = await route.fetch();
      const payload = (await response.json()) as {
        data: Record<string, unknown>;
      };
      await route.fulfill({
        response,
        json: {
          ...payload,
          data: {
            ...payload.data,
            imageUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
          },
        },
      });
    },
  );

  await page.goto(productPath);
  const image = page.getByRole("img", { name: "Local Demo Product" });
  await expect(image).toBeVisible();

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    const gallery = await page.locator('[data-has-image="true"][class*="productDetailMedia"]').evaluate(
      (element) => {
        const dimensions = element.getBoundingClientRect();
        const image = element.querySelector("img");
        return {
          ratio: dimensions.width / dimensions.height,
          fit: image ? getComputedStyle(image).objectFit : null,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      },
    );

    expect(gallery.ratio).toBeGreaterThan(0.95);
    expect(gallery.ratio).toBeLessThan(1.05);
    expect(gallery.fit).toBe("contain");
    expect(gallery.horizontalOverflow).toBeLessThanOrEqual(0);
  }

  await expect(page.getByText("ยังไม่มีรูปสินค้า")).toHaveCount(0);
});
