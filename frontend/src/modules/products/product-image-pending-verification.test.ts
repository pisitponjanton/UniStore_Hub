import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPendingProductImage,
  savePendingProductImage,
  clearPendingProductImage,
  canRememberPendingProductImage,
} from "./product-image-pending-verification";

describe("Product image committed-readback tab-session markers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("isolates marker by user, organization and product, and never uses localStorage", () => {
    expect(savePendingProductImage("user-A", "org-A", "product-A", "image-key-A")).toBe(true);
    expect(readPendingProductImage("user-A", "org-A", "product-A")).toBe("image-key-A");
    expect(readPendingProductImage("user-B", "org-A", "product-A")).toBeNull();
    expect(readPendingProductImage("user-A", "org-B", "product-A")).toBeNull();
    expect(readPendingProductImage("user-A", "org-A", "product-B")).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(1);
  });

  it("clears only the verified product and preserves unrelated pending verification", () => {
    savePendingProductImage("user-A", "org-A", "product-A", "acknowledged-A");
    savePendingProductImage("user-A", "org-A", "product-B", "acknowledged-B");
    clearPendingProductImage("user-A", "org-A", "product-A");
    expect(readPendingProductImage("user-A", "org-A", "product-A")).toBeNull();
    expect(readPendingProductImage("user-A", "org-A", "product-B")).toBe("acknowledged-B");
    expect(window.sessionStorage.length).toBe(1);
  });

  it("fails safely when verification marker storage is denied", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked by privacy policy", "SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked by privacy policy", "SecurityError");
    });
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Blocked by privacy policy", "SecurityError");
    });
    try {
      expect(savePendingProductImage("user-A", "org-A", "product-A", "acknowledged")).toBe(false);
      expect(readPendingProductImage("user-A", "org-A", "product-A")).toBeNull();
      expect(() => clearPendingProductImage("user-A", "org-A", "product-A")).not.toThrow();
    } finally {
      get.mockRestore();
      set.mockRestore();
      remove.mockRestore();
    }
  });

  it("reports session storage quota exhaustion instead of claiming persistence", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exhausted", "QuotaExceededError");
    });
    try {
      expect(savePendingProductImage("user-A", "org-A", "product-A", "acknowledged")).toBe(false);
      expect(window.sessionStorage.length).toBe(0);
    } finally {
      set.mockRestore();
    }
  });

  it("checks marker storage with a temporary probe and leaves no residue", () => {
    expect(canRememberPendingProductImage("user-A", "org-A", "product-A")).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("reports denied marker storage at first load without changing auth storage", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key.includes("productImageVerification.v1")) {
        throw new DOMException("Blocked marker namespace", "SecurityError");
      }
    });
    try {
      expect(canRememberPendingProductImage("user-A", "org-A", "product-A")).toBe(false);
      expect(window.sessionStorage.length).toBe(0);
    } finally { set.mockRestore(); }
  });
});
