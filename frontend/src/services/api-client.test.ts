import { describe, expect, it, vi } from "vitest";

import { ApiClient, ApiClientError } from "./api-client";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("serializes query parameters and unwraps success envelopes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { items: [{ id: "1" }], nextCursor: null },
      }),
    );

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1/",
      fetchImpl: fetchMock,
    });

    const result = await client.getList<{ id: string }>("/products", {
      query: { status: "ACTIVE", cursor: null, page: 2 },
    });

    expect(result.items).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/api/v1/products?status=ACTIVE&page=2",
    );
  });

  it("adds Bearer JWT only when an authenticated request has a token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }));

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      getAccessToken: () => "test-jwt",
      fetchImpl: fetchMock,
    });

    await client.get("/me", { authenticated: true });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(headers.get("Authorization")).toBe("Bearer test-jwt");
  });

  it("serializes JSON request bodies", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ success: true, data: { orderId: "o1" } }));

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: fetchMock,
    });

    await client.post("/organizations/org/orders", {
      campaignId: "c1",
      items: [{ productId: "p1", variantId: "v1", quantity: 2 }],
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(requestInit?.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(requestInit?.body).toBe(
      JSON.stringify({
        campaignId: "c1",
        items: [{ productId: "p1", variantId: "v1", quantity: 2 }],
      }),
    );
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
    [500, "server"],
  ] as const)("distinguishes HTTP %s errors as %s", async (status, kind) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: status === 404 ? "ORDER_NOT_FOUND" : "INTERNAL_ERROR",
            message: "Request failed",
          },
        },
        status,
      ),
    );

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: fetchMock,
    });

    try {
      await client.get("/orders/o1");
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as ApiClientError).kind).toBe(kind);
      expect((error as ApiClientError).status).toBe(status);
    }
  });

  it("never retries a failed state-changing request automatically", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Temporary failure",
          },
        },
        500,
      ),
    );

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: fetchMock,
    });

    await expect(
      client.post("/organizations/org/campaigns/c1/open"),
    ).rejects.toBeInstanceOf(ApiClientError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("supports documented 204 delete responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: fetchMock,
    });

    await expect(client.delete("/products/p1")).resolves.toBeUndefined();
  });

  it("turns network failures into a safe client error without exposing stack data", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("socket internal details"));

    const client = new ApiClient({
      baseUrl: "http://localhost:4000/api/v1",
      fetchImpl: fetchMock,
    });

    await expect(client.get("/me")).rejects.toMatchObject({
      kind: "network",
      code: "INTERNAL_ERROR",
      userMessage: expect.any(String),
    });
  });
});
