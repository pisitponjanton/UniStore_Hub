// Acknowledged imageKey PATCH means retrying the complete upload is unsafe.
// Keep only a product-scoped readback marker in the current browser tab.
// Never store a signed URL, access token or the original file.
const PREFIX = "unistoreHub.productImageVerification.v1";

function storageKey(userId: string, organizationId: string, productId: string): string {
  return [PREFIX, userId, organizationId, productId]
    .map(encodeURIComponent)
    .join(":");
}

export function readPendingProductImage(
  userId: string,
  organizationId: string,
  productId: string,
): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(userId, organizationId, productId));
  } catch {
    return null;
  }
}

export function savePendingProductImage(
  userId: string,
  organizationId: string,
  productId: string,
  imageKey: string,
): boolean {
  try {
    window.sessionStorage.setItem(storageKey(userId, organizationId, productId), imageKey);
    return true;
  } catch {
    // Storage can be unavailable (private browsing/strict settings).
    // Keep the pending key in React state for the current mounted view only.
    return false;
  }
}

export function clearPendingProductImage(
  userId: string,
  organizationId: string,
  productId: string,
): void {
  try {
    window.sessionStorage.removeItem(storageKey(userId, organizationId, productId));
  } catch {
    // Storage was unavailable; do not turn a verified success into an error.
  }
}


// Probe only the dedicated verification marker namespace; never touch auth
// credentials. A blocked marker store means reload recovery is not guaranteed.
export function canRememberPendingProductImage(
  userId: string, organizationId: string, productId: string,
): boolean {
  const key = storageKey(userId, organizationId, productId) + ":probe";
  try {
    window.sessionStorage.setItem(key, "1");
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
