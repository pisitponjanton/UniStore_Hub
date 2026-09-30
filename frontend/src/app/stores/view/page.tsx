import type { Metadata } from "next";

import { StoreView } from "@/modules/storefront";

export const metadata: Metadata = {
  title: "ร้านค้า | UniStore Hub",
};

export default function StoreViewPage() {
  return <StoreView />;
}
