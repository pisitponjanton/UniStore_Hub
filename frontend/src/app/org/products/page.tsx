import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { ProductRoute } from "@/modules/products";

export const metadata: Metadata = {
  title: "สินค้า | UniStore Hub",
};

export default function ProductsPage() {
  return (
    <AuthenticatedBoundary>
      <ProductRoute />
    </AuthenticatedBoundary>
  );
}
