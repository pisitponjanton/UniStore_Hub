import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { MyPaymentView } from "@/modules/payments";

export const metadata: Metadata = {
  title: "การชำระเงิน | UniStore Hub",
};

export default function MyPaymentPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <MyPaymentView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
