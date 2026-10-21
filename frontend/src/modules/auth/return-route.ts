const DEFAULT_AUTH_RETURN_PATH = "/";

export interface AuthNavigationContext {
  returnPath: string;
  hasReturnContext: boolean;
  loginHref: string;
  registerHref: string;
}

export function sanitizeAuthReturnPath(
  value: string | null | undefined,
): string {
  if (!value) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  return candidate;
}

export function getAuthReturnPath(search: string): string {
  const params = new URLSearchParams(search);
  return sanitizeAuthReturnPath(params.get("returnTo"));
}

export function buildAuthPagePath(
  targetPath: "/login/" | "/register/",
  returnPath: string | null | undefined,
): string {
  const safeReturnPath = sanitizeAuthReturnPath(returnPath);

  if (safeReturnPath === DEFAULT_AUTH_RETURN_PATH) {
    return targetPath;
  }

  const params = new URLSearchParams({ returnTo: safeReturnPath });
  return `${targetPath}?${params.toString()}`;
}

export function getAuthNavigationContext(search: string): AuthNavigationContext {
  const returnPath = getAuthReturnPath(search);
  const hasReturnContext = returnPath !== DEFAULT_AUTH_RETURN_PATH;

  return {
    returnPath,
    hasReturnContext,
    loginHref: buildAuthPagePath("/login/", returnPath),
    registerHref: buildAuthPagePath("/register/", returnPath),
  };
}

export function describeAuthReturnDestination(path: string): string {
  const pathname = path.split("?")[0] ?? "/";
  if (pathname.startsWith("/orders/new")) return "กลับไปตรวจสอบคำสั่งซื้อ";
  if (pathname.startsWith("/my/payment")) return "กลับไปส่งหลักฐานชำระเงิน";
  if (pathname.startsWith("/my/pickup")) return "กลับไปดูข้อมูลรับสินค้า";
  if (pathname.startsWith("/my/order")) return "กลับไปติดตามคำสั่งซื้อ";
  if (pathname.startsWith("/products/view")) return "กลับไปดูสินค้า";
  if (pathname.startsWith("/campaigns/view")) return "กลับไปดูรอบพรีออเดอร์";
  if (pathname.startsWith("/stores/view")) return "กลับไปหน้าร้านค้า";
  if (pathname.startsWith("/org/")) return "กลับไปพื้นที่หน่วยงาน";
  if (pathname.startsWith("/platform/")) return "กลับไปพื้นที่ผู้ดูแลระบบ";
  return "กลับไปทำรายการต่อ";
}

/** This is an exit from the auth form, not a successful-login returnTo.
 * Never send an anonymous visitor back into a protected route/login loop.
 * For an order continuation, recover the public product context when its
 * source IDs are valid; otherwise offer the storefront.
 */
export function getUnauthenticatedExit(returnPath: string): {
  href: string;
  label: string;
} {
  const safe = sanitizeAuthReturnPath(returnPath);
  const question = safe.indexOf("?");
  const pathname = (question === -1 ? safe : safe.slice(0, question)).replace(/\/+$/, "") || "/";

  if (pathname === "/orders/new") {
    const query = new URLSearchParams(question === -1 ? "" : safe.slice(question + 1));
    const organizationId = query.get("organizationId");
    const productId = query.get("productId");
    const campaignId = query.get("campaignId");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (organizationId && productId && uuid.test(organizationId) && uuid.test(productId)) {
      const params = new URLSearchParams({ organizationId, productId });
      if (campaignId && uuid.test(campaignId)) params.set("campaignId", campaignId);
      return { href: "/products/view/?" + params.toString(), label: "กลับไปดูสินค้า" };
    }
    return { href: "/", label: "กลับหน้าร้านค้า" };
  }

  if (/^\/(?:my|org|platform|notifications)(?:\/|$)/.test(pathname)) {
    return { href: "/", label: "กลับหน้าร้านค้า" };
  }

  return {
    href: safe,
    label: safe === "/" ? "กลับหน้าร้านค้า" : "กลับไปหน้าที่กำลังใช้งาน",
  };
}
