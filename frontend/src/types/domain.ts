export type EntityId = string;
export type IsoDateTime = string;
export type Cursor = string;
export type Satang = number;

export const ROLE_TOKENS = [
  "CUSTOMER",
  "STAFF",
  "ORGANIZATION_ADMIN",
  "PLATFORM_ADMIN",
] as const;

export type RoleToken = (typeof ROLE_TOKENS)[number];
export type MembershipRole = Extract<
  RoleToken,
  "STAFF" | "ORGANIZATION_ADMIN"
>;
export type PlatformRole = Extract<RoleToken, "PLATFORM_ADMIN">;

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ORGANIZATION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const RESOURCE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "PRODUCING",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_REVIEW",
  "PAID",
  "PAYMENT_REJECTED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_FOR_PICKUP",
  "RECEIVED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PICKUP_STATUSES = ["READY", "RECEIVED"] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "PAYMENT_APPROVED",
  "PAYMENT_REJECTED",
  "READY_FOR_PICKUP",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface UserDTO {
  userId: EntityId;
  email: string;
  name: string;
  status: UserStatus;
  platformRole: PlatformRole | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type CurrentUserDTO = Pick<
  UserDTO,
  "userId" | "email" | "name" | "status" | "platformRole"
>;

export interface OrganizationDTO {
  organizationId: EntityId;
  name: string;
  description: string;
  status: OrganizationStatus;
  createdBy: EntityId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OrganizationMemberUserDTO {
  userId: EntityId;
  email: string;
  name: string;
}

export interface OrganizationMemberDTO {
  organizationId: EntityId;
  userId: EntityId;
  role: MembershipRole;
  status: MembershipStatus;
  user: OrganizationMemberUserDTO;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CurrentMembershipDTO {
  organizationId: EntityId;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface StoreDTO {
  storeId: EntityId;
  organizationId: EntityId;
  name: string;
  description: string;
  status: ResourceStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProductVariantDTO {
  variantId: EntityId;
  organizationId: EntityId;
  productId: EntityId;
  name: string;
  price: Satang;
  status: ResourceStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProductDTO {
  productId: EntityId;
  organizationId: EntityId;
  storeId: EntityId;
  name: string;
  description: string;
  imageKey: string | null;
  imageUrl: string | null;
  status: ResourceStatus;
  variants?: ProductVariantDTO[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type StorefrontProductDTO = Omit<ProductDTO, "imageKey">;

export interface CampaignDTO {
  campaignId: EntityId;
  organizationId: EntityId;
  storeId: EntityId;
  name: string;
  openAt: IsoDateTime | null;
  closeAt: IsoDateTime | null;
  paymentDeadline: IsoDateTime | null;
  pickupAt: IsoDateTime | null;
  status: CampaignStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OrderItemDTO {
  orderItemId: EntityId;
  productId: EntityId;
  variantId: EntityId;
  productName: string;
  variantName: string;
  unitPrice: Satang;
  quantity: number;
  totalPrice: Satang;
}

export interface OrderDTO {
  orderId: EntityId;
  organizationId: EntityId;
  campaignId: EntityId;
  customerId: EntityId;
  status: OrderStatus;
  subtotal: Satang;
  total: Satang;
  items: OrderItemDTO[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PaymentDTO {
  paymentId: EntityId;
  organizationId: EntityId;
  orderId: EntityId;
  customerId: EntityId;
  slipKey: string;
  status: PaymentStatus;
  rejectReason: string | null;
  reviewedBy: EntityId | null;
  reviewedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PickupDTO {
  pickupId: EntityId;
  organizationId: EntityId;
  orderId: EntityId;
  token: string;
  status: PickupStatus;
  receivedBy: EntityId | null;
  receivedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AuditLogDTO {
  auditId: EntityId;
  organizationId: EntityId;
  actorId: EntityId;
  action: string;
  resourceType: string;
  resourceId: EntityId;
  metadata: unknown;
  createdAt: IsoDateTime;
}

export interface NotificationDTO {
  notificationId: EntityId;
  userId: EntityId;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: string;
  resourceId: EntityId;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}
