import type { ReactNode } from "react";

/** Original 24px line icons, unified stroke and optical size. No remote SVG asset dependency. */
export type WorkspaceIconName =
  | "store" | "orders" | "payment" | "pickup" | "notifications" | "overview"
  | "organization" | "staff" | "products" | "campaigns" | "production"
  | "settings" | "audit" | "users" | "platform" | "chevron" | "external";

const paths: Record<WorkspaceIconName, ReactNode> = {
  store: <><path d="M3 10h18l-2-6H5l-2 6Z" /><path d="M4 10v10h16V10M9 20v-7h6v7M3 10c1 2 3 2 4 0 1 2 3 2 5 0 1 2 3 2 5 0 1 2 3 2 4 0" /></>,
  orders: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  payment: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></>,
  pickup: <><path d="M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2" /><path d="m10 14 2 2 3-4" /></>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  overview: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></>,
  organization: <><path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-6h6v6M8 10h1m6 0h1" /></>,
  staff: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8a3 3 0 0 1 0 6M18 16c2 .5 3 2 3 4" /></>,
  products: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10" /></>,
  campaigns: <><path d="M3 11v3l12 4V7L3 11ZM15 9l5-3v13l-5-3M7 15l2 6h4l-2-5" /></>,
  production: <><path d="M3 21V9l6 4V9l6 4V5h6v16H3Z" /><path d="M7 17h2m3 0h2m3 0h2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" /></>,
  audit: <><path d="M7 3h10l3 3v15H4V3h3Zm6 0v4h7" /><path d="m8 14 3 3 5-6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M17 5a3 3 0 0 1 0 6M17 15c2 0 4 2 4 5" /></>,
  platform: <><path d="m12 2 9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z" /><path d="m9 12 2 2 4-4" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  external: <><path d="M11 5h8v8M19 5l-9 9M18 14v5H5V6h5" /></>,
};

export function WorkspaceIcon({ name, size = 19 }: { name: WorkspaceIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function navigationIcon(href: string): WorkspaceIconName {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/platform/")) return path.includes("users") ? "users" : "platform";
  if (path.includes("/org/staff")) return "staff";
  if (path.includes("/org/select") || path.includes("/org/settings")) return "organization";
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
