import type { Metadata } from "next";

import { ProductView } from "@/modules/storefront";

export const metadata: Metadata = {
  title: "สินค้า | UniStore Hub",
};

export default function ProductViewPage() {
  return <ProductView />;
}
