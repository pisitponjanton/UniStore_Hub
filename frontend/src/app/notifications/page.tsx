import type { Metadata } from "next";

import {
  AuthenticatedBoundary,
  AuthenticatedShell,
} from "@/modules/auth";
import { NotificationsView } from "@/modules/notifications";

export const metadata: Metadata = {
  title: "การแจ้งเตือน | UniStore Hub",
};

export default function NotificationsPage() {
  return (
    <AuthenticatedBoundary>
      <AuthenticatedShell>
        <NotificationsView />
      </AuthenticatedShell>
    </AuthenticatedBoundary>
  );
}
