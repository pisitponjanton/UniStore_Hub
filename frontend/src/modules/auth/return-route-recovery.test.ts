import { describe, expect, it } from "vitest";
import { buildAuthPagePath, getAuthReturnPath, getUnauthenticatedExit, sanitizeAuthReturnPath } from "./return-route";

const order = "/orders/new/?organizationId=55555555-5555-4555-8555-555555555555&campaignId=99999999-9999-4999-8999-999999999998&productId=77777777-7777-4777-8777-777777777778&variantId=88888888-8888-4888-8888-888888888888";

describe("auth returnTo and anonymous recovery", () => {
  it("preserves full checkout context after successful login", () => {
    const login = buildAuthPagePath("/login/", order);
    expect(getAuthReturnPath(login.slice(login.indexOf("?")))).toBe(order);
    expect(getAuthReturnPath(buildAuthPagePath("/register/", order).split("?")[1] ?? "")).toBe(order);
  });
  it("returns an anonymous customer to the public product instead of the order gate", () => {
    const exit = getUnauthenticatedExit(order);
    const url = new URL(exit.href, "https://unistore.example");
    expect(url.pathname).toBe("/products/view/");
    expect(url.searchParams.get("organizationId")).toBe("55555555-5555-4555-8555-555555555555");
    expect(url.searchParams.get("campaignId")).toBe("99999999-9999-4999-8999-999999999998");
    expect(url.searchParams.get("productId")).toBe("77777777-7777-4777-8777-777777777778");
    expect(exit.label).toBe("กลับไปดูสินค้า");
  });
  it("avoids redirect loops for invalid checkout IDs and other protected screens", () => {
    for (const path of ["/orders/new/?organizationId=wrong", "/my/payment/", "/org/orders/", "/platform/users/"]) {
      expect(getUnauthenticatedExit(path)).toEqual({ href: "/", label: "กลับหน้าร้านค้า" });
    }
  });
  it("rejects external and protocol-relative return paths", () => {
    for (const value of ["https://evil.example", "//evil.example/a", "/\\evil", "/\n/orders/new/"]) {
      expect(sanitizeAuthReturnPath(value)).toBe("/");
      expect(getUnauthenticatedExit(value).href).toBe("/");
    }
  });
});
