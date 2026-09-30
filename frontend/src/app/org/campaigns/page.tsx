import type { Metadata } from "next";

import { AuthenticatedBoundary } from "@/modules/auth";
import { CampaignRoute } from "@/modules/campaigns";

export const metadata: Metadata = {
  title: "Campaign | UniStore Hub",
};

export default function CampaignsPage() {
  return (
    <AuthenticatedBoundary>
      <CampaignRoute />
    </AuthenticatedBoundary>
  );
}
