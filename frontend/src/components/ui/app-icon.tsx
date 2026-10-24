import {
  ArrowRight, ArrowUpRight, Bell, Building2, Check, ChevronRight,
  ClipboardCheck, ClipboardList, CreditCard, ExternalLink, Factory,
  ImageOff, LayoutDashboard, Megaphone, Package, Settings,
  ShieldCheck, ShoppingBag, Store, Users, UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * One functional icon vocabulary for public, customer, staff and admin views.
 * Each icon is decoration inside a labeled action, never a UniStore brand mark.
 */
const iconSet = {
  store: Store,
  orders: ClipboardList,
  payment: CreditCard,
  pickup: ShoppingBag,
  notifications: Bell,
  overview: LayoutDashboard,
  organization: Building2,
  staff: UsersRound,
  products: Package,
  campaigns: Megaphone,
  production: Factory,
  settings: Settings,
  audit: ClipboardCheck,
  users: Users,
  platform: ShieldCheck,
  chevron: ChevronRight,
  external: ExternalLink,
  "arrow-up-right": ArrowUpRight,
  "arrow-right": ArrowRight,
  check: Check,
  "image-off": ImageOff,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof iconSet;

export function AppIcon({
  name,
  size = 18,
  className,
}: {
  name: AppIconName;
  size?: number;
  className?: string;
}) {
  const Icon = iconSet[name];
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, verticalAlign: "-0.125em" }}
      size={size}
      strokeWidth={name === "arrow-up-right" ? 3 : 1.8}
      absoluteStrokeWidth
    />
  );
}
