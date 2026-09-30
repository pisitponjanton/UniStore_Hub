import type { Metadata } from "next";

import { CampaignView } from "@/modules/storefront";

export const metadata: Metadata = {
  title: "แคมเปญ | UniStore Hub",
};

export default function CampaignViewPage() {
  return <CampaignView />;
}
