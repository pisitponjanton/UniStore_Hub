import type {
  CampaignStatus,
  EntityId,
  OrderStatus,
  Satang,
  UserStatus,
  OrganizationStatus,
} from "./domain";

export interface ProductionVariantSummaryDTO {
  variantId: EntityId;
  variantName: string;
  quantity: number;
}

export interface ProductionProductSummaryDTO {
  productId: EntityId;
  productName: string;
  variants: ProductionVariantSummaryDTO[];
}

export interface ProductionSummaryDTO {
  campaignId: EntityId;
  products: ProductionProductSummaryDTO[];
}

export type CampaignStatusCounts = Partial<Record<CampaignStatus, number>>;
export type OrderStatusCounts = Partial<Record<OrderStatus, number>>;

export interface OrganizationReportDTO {
  totalStores: number;
  totalProducts: number;
  campaignsByStatus: CampaignStatusCounts;
  ordersByStatus: OrderStatusCounts;
  pendingPaymentReviews: number;
  paidOrderCount: number;
  paidRevenueSatang: Satang;
}

export interface PlatformSummaryDTO {
  organizationsByStatus: Partial<Record<OrganizationStatus, number>>;
  usersByStatus: Partial<Record<UserStatus, number>>;
}
