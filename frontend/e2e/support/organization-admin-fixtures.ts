import type {
  APIRequestContext,
  BrowserContext,
} from "@playwright/test";

import {
  apiJson,
  establishTokenSession,
} from "./customer-commerce-fixtures";
import { getSeedRoleToken } from "./seed-auth";

export interface AdminOrganizationFixture {
  organizationId: string;
  organizationName: string;
  adminToken: string;
}

export async function createApprovedAdminOrganization(
  request: APIRequestContext,
  runId: string,
): Promise<AdminOrganizationFixture> {
  const adminToken = await getSeedRoleToken(
    request,
    "organizationAdmin",
  );
  const platformToken = await getSeedRoleToken(
    request,
    "platformAdmin",
  );

  const organizationName = `QA Admin Org ${runId}`;
  const organization = await apiJson<{
    organizationId: string;
    status: string;
  }>(request, "/organizations", {
    method: "POST",
    token: adminToken,
    data: {
      name: organizationName,
      description: "Disposable Organization Admin audit fixture",
    },
    expectedStatus: 201,
  });

  if (organization.status === "PENDING") {
    await apiJson(
      request,
      `/platform/organizations/${organization.organizationId}/approve`,
      {
        method: "POST",
        token: platformToken,
        expectedStatus: 200,
      },
    );
  }

  return {
    organizationId: organization.organizationId,
    organizationName,
    adminToken,
  };
}

export async function establishAdminOrganizationSession(
  context: BrowserContext,
  fixture: AdminOrganizationFixture,
): Promise<void> {
  await establishTokenSession(context, fixture.adminToken);
  await context.addInitScript(
    ({ organizationId }) => {
      window.sessionStorage.setItem(
        "unistoreHub.activeOrganizationId",
        organizationId,
      );
    },
    { organizationId: fixture.organizationId },
  );
}
