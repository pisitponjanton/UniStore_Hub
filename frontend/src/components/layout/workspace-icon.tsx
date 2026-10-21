import { AppIcon } from "@/components/ui/app-icon";
import type { AppIconName } from "@/components/ui/app-icon";

/** Compatibility name: every role now uses the same Lucide-backed functional icons. */
export { AppIcon as WorkspaceIcon };
export type WorkspaceIconName = AppIconName;

export function navigationIcon(href: string): WorkspaceIconName {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/platform/")) return path.includes("users") ? "users" : "platform";
  if (path.includes("/org/staff")) return "staff";
  if (path.includes("/org/select")) return "organization";
  if (path.includes("/org/settings")) return "settings";
  if (path.includes("/org/production")) return "production";
  if (path.includes("/org/audit")) return "audit";
  if (path.includes("/org/dashboard")) return "overview";
  if (path.includes("/org/campaigns")) return "campaigns";
  if (path.includes("/org/products")) return "products";
  if (path.includes("/org/stores")) return "store";
  if (path.includes("/org/payments") || path.includes("/my/payment")) return "payment";
  if (path.includes("/org/pickups") || path.includes("/my/pickup")) return "pickup";
  if (path.includes("/orders") || path.includes("/order")) return "orders";
  if (path.includes("/notifications")) return "notifications";
  return "store";
}
