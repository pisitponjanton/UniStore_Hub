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
