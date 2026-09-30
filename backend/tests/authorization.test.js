'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOrganizationContextMiddleware,
  createOrganizationMembershipMiddleware,
  createOrganizationProfileAccessMiddleware,
  requireOrganizationRoles,
  requireOperationalOrganization,
} = require('../src/middleware/organization.middleware');
const {
  USER_STATUS,
} = require('../src/modules/auth/auth.constants');
const {
  ORGANIZATION_ROLE,
  MEMBERSHIP_STATUS,
} = require('../src/modules/members/member.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  PLATFORM_ROLE,
} = require('../src/modules/platform-admin/platform-admin.constants');
const {
  requireActiveMembership,
  requireActiveOrganization,
  requireCustomerResourceAccess,
  requireOrganizationRole,
  requireResourceOwnership,
  requireTenantMatch,
} = require('../src/policies/organization.policy');

function createNextRecorder() {
  const calls = [];

  return {
    calls,
    next(error) {
      calls.push(error);
    },
  };
}

test('tenant policy accepts only resources whose stored organizationId matches route context', () => {
  const resource = {
    organizationId: 'org-1',
    orderId: 'order-1',
  };

  assert.equal(requireTenantMatch(resource, 'org-1'), resource);

  assert.throws(
    () => requireTenantMatch(resource, 'org-2'),
    (error) =>
      error.code === 'TENANT_MISMATCH' &&
      error.httpStatus === 403,
  );

  assert.throws(
    () => requireTenantMatch(null, 'org-1'),
    (error) => error.code === 'TENANT_MISMATCH',
  );
});

test('customer ownership policy requires the authenticated user to own the resource', () => {
  const order = {
    organizationId: 'org-1',
    customerId: 'user-1',
    orderId: 'order-1',
  };

  assert.equal(requireResourceOwnership(order, 'user-1'), order);

  assert.throws(
    () => requireResourceOwnership(order, 'user-2'),
    (error) =>
      error.code === 'RESOURCE_OWNERSHIP_REQUIRED' &&
      error.httpStatus === 403,
  );
});

test('customer resource access enforces tenant match before ownership', () => {
  const order = {
    organizationId: 'org-1',
    customerId: 'user-1',
  };

  assert.equal(
    requireCustomerResourceAccess({
      resource: order,
      organizationId: 'org-1',
      userId: 'user-1',
    }),
    order,
  );

  assert.throws(
    () =>
      requireCustomerResourceAccess({
        resource: order,
        organizationId: 'org-2',
        userId: 'user-1',
      }),
    (error) => error.code === 'TENANT_MISMATCH',
  );

  assert.throws(
    () =>
      requireCustomerResourceAccess({
        resource: order,
        organizationId: 'org-1',
        userId: 'user-2',
      }),
    (error) => error.code === 'RESOURCE_OWNERSHIP_REQUIRED',
  );
});

test('active membership policy rejects missing and inactive memberships', () => {
  const activeMembership = {
    organizationId: 'org-1',
    userId: 'user-1',
    role: ORGANIZATION_ROLE.STAFF,
    status: MEMBERSHIP_STATUS.ACTIVE,
  };

  assert.equal(requireActiveMembership(activeMembership), activeMembership);

  for (const membership of [
    null,
    { ...activeMembership, status: MEMBERSHIP_STATUS.INACTIVE },
  ]) {
    assert.throws(
      () => requireActiveMembership(membership),
      (error) =>
        error.code === 'MEMBERSHIP_REQUIRED' &&
        error.httpStatus === 403,
    );
  }
});

test('organization role policy uses stored membership role and rejects unauthorized role', () => {
  const staffMembership = {
    organizationId: 'org-1',
    userId: 'user-1',
    role: ORGANIZATION_ROLE.STAFF,
    status: MEMBERSHIP_STATUS.ACTIVE,
  };

  assert.equal(
    requireOrganizationRole(staffMembership, [
      ORGANIZATION_ROLE.STAFF,
      ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    ]),
    staffMembership,
  );

  assert.throws(
    () =>
      requireOrganizationRole(staffMembership, [
        ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      ]),
    (error) =>
      error.code === 'ROLE_FORBIDDEN' &&
      error.httpStatus === 403,
  );
});

test('operational organization policy requires ACTIVE status', () => {
  const activeOrganization = {
    organizationId: 'org-1',
    status: ORGANIZATION_STATUS.ACTIVE,
  };

  assert.equal(
    requireActiveOrganization(activeOrganization),
    activeOrganization,
  );

  for (const status of [
    ORGANIZATION_STATUS.PENDING,
    ORGANIZATION_STATUS.SUSPENDED,
  ]) {
    assert.throws(
      () =>
        requireActiveOrganization({
          organizationId: 'org-1',
          status,
        }),
      (error) =>
        error.code === 'FORBIDDEN' &&
        error.httpStatus === 403,
    );
  }
});

test('organization context middleware loads by route organizationId and rejects missing organizations', async () => {
  const loadedIds = [];
  const middleware = createOrganizationContextMiddleware({
    organizationRepository: {
      async getById(organizationId) {
        loadedIds.push(organizationId);

        if (organizationId === 'org-1') {
          return {
            organizationId: 'org-1',
            status: ORGANIZATION_STATUS.ACTIVE,
          };
        }

        return null;
      },
    },
  });

  const successReq = {
    params: { organizationId: 'org-1' },
  };
  const success = createNextRecorder();

  await middleware(successReq, {}, success.next);

  assert.deepEqual(loadedIds, ['org-1']);
  assert.deepEqual(successReq.organization, {
    organizationId: 'org-1',
    status: ORGANIZATION_STATUS.ACTIVE,
  });
  assert.deepEqual(success.calls, [undefined]);

  const missingReq = {
    params: { organizationId: 'org-missing' },
  };
  const missing = createNextRecorder();

  await middleware(missingReq, {}, missing.next);

  assert.equal(missing.calls.length, 1);
  assert.equal(missing.calls[0].code, 'ORGANIZATION_NOT_FOUND');
  assert.equal(missing.calls[0].httpStatus, 404);
});

test('organization context middleware rejects a repository result from another tenant', async () => {
  const middleware = createOrganizationContextMiddleware({
    organizationRepository: {
      async getById() {
        return {
          organizationId: 'org-other',
          status: ORGANIZATION_STATUS.ACTIVE,
        };
      },
    },
  });

  const req = {
    params: { organizationId: 'org-1' },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].code, 'TENANT_MISMATCH');
  assert.equal(req.organization, undefined);
});

test('membership middleware resolves membership from organization and authenticated user only', async () => {
  const lookups = [];
  const membership = {
    organizationId: 'org-1',
    userId: 'user-1',
    role: ORGANIZATION_ROLE.STAFF,
    status: MEMBERSHIP_STATUS.ACTIVE,
  };
  const middleware = createOrganizationMembershipMiddleware({
    memberRepository: {
      async getByOrganizationAndUser(organizationId, userId) {
        lookups.push({ organizationId, userId });
        return membership;
      },
    },
  });

  const req = {
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
    user: {
      userId: 'user-1',
    },
    body: {
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      organizationId: 'org-other',
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.deepEqual(lookups, [
    {
      organizationId: 'org-1',
      userId: 'user-1',
    },
  ]);
  assert.equal(req.membership, membership);
  assert.equal(req.membership.role, ORGANIZATION_ROLE.STAFF);
  assert.deepEqual(recorder.calls, [undefined]);
});

test('membership middleware rejects missing and inactive stored membership', async () => {
  for (const storedMembership of [
    null,
    {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.STAFF,
      status: MEMBERSHIP_STATUS.INACTIVE,
    },
  ]) {
    const middleware = createOrganizationMembershipMiddleware({
      memberRepository: {
        async getByOrganizationAndUser() {
          return storedMembership;
        },
      },
    });

    const req = {
      organization: {
        organizationId: 'org-1',
        status: ORGANIZATION_STATUS.ACTIVE,
      },
      user: {
        userId: 'user-1',
      },
    };
    const recorder = createNextRecorder();

    await middleware(req, {}, recorder.next);

    assert.equal(recorder.calls.length, 1);
    assert.equal(recorder.calls[0].code, 'MEMBERSHIP_REQUIRED');
    assert.equal(req.membership, undefined);
  }
});

test('membership middleware rejects stored membership from another tenant', async () => {
  const middleware = createOrganizationMembershipMiddleware({
    memberRepository: {
      async getByOrganizationAndUser() {
        return {
          organizationId: 'org-2',
          userId: 'user-1',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
      },
    },
  });

  const req = {
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
    user: {
      userId: 'user-1',
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].code, 'TENANT_MISMATCH');
  assert.equal(req.membership, undefined);
});

test('role middleware ignores client-supplied role and trusts resolved membership only', () => {
  const middleware = requireOrganizationRoles(
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );

  const deniedReq = {
    membership: {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.STAFF,
      status: MEMBERSHIP_STATUS.ACTIVE,
    },
    body: {
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    },
  };
  const denied = createNextRecorder();

  middleware(deniedReq, {}, denied.next);

  assert.equal(denied.calls.length, 1);
  assert.equal(denied.calls[0].code, 'ROLE_FORBIDDEN');

  const allowedReq = {
    membership: {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      status: MEMBERSHIP_STATUS.ACTIVE,
    },
    body: {
      role: ORGANIZATION_ROLE.STAFF,
    },
  };
  const allowed = createNextRecorder();

  middleware(allowedReq, {}, allowed.next);

  assert.deepEqual(allowed.calls, [undefined]);
});

test('Organization Admin can pass Staff-or-Admin operational role checks', () => {
  const middleware = requireOrganizationRoles(
    ORGANIZATION_ROLE.STAFF,
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  const req = {
    membership: {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      status: MEMBERSHIP_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  middleware(req, {}, recorder.next);

  assert.deepEqual(recorder.calls, [undefined]);
});

test('operational organization middleware allows ACTIVE and rejects PENDING/SUSPENDED', () => {
  const allowed = createNextRecorder();

  requireOperationalOrganization(
    {
      organization: {
        organizationId: 'org-1',
        status: ORGANIZATION_STATUS.ACTIVE,
      },
    },
    {},
    allowed.next,
  );

  assert.deepEqual(allowed.calls, [undefined]);

  for (const status of [
    ORGANIZATION_STATUS.PENDING,
    ORGANIZATION_STATUS.SUSPENDED,
  ]) {
    const denied = createNextRecorder();

    requireOperationalOrganization(
      {
        organization: {
          organizationId: 'org-1',
          status,
        },
      },
      {},
      denied.next,
    );

    assert.equal(denied.calls.length, 1);
    assert.equal(denied.calls[0].code, 'FORBIDDEN');
  }
});

test('customer ownership path does not require OrganizationMember', () => {
  const order = {
    organizationId: 'org-1',
    customerId: 'customer-1',
  };

  assert.doesNotThrow(() =>
    requireCustomerResourceAccess({
      resource: order,
      organizationId: 'org-1',
      userId: 'customer-1',
    }),
  );
});


test('organization profile access allows persisted Platform Admin without Organization membership', async () => {
  const lookups = [];
  const middleware = createOrganizationProfileAccessMiddleware({
    allowedOrganizationRoles: [
      ORGANIZATION_ROLE.STAFF,
      ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    ],
    memberRepository: {
      async getByOrganizationAndUser(organizationId, userId) {
        lookups.push(['membership', organizationId, userId]);
        return null;
      },
    },
    userRepository: {
      async getById(userId) {
        lookups.push(['user', userId]);
        return {
          userId,
          email: 'platform@example.com',
          name: 'Platform Admin',
          status: USER_STATUS.ACTIVE,
          platformRole: PLATFORM_ROLE.PLATFORM_ADMIN,
          createdAt: '2026-09-30T00:00:00.000Z',
          updatedAt: '2026-09-30T00:00:00.000Z',
        };
      },
    },
  });
  const req = {
    user: {
      userId: 'platform-1',
      platformRole: null,
    },
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.deepEqual(lookups, [
    ['membership', 'org-1', 'platform-1'],
    ['user', 'platform-1'],
  ]);
  assert.deepEqual(recorder.calls, [undefined]);
  assert.equal(
    req.user.platformRole,
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );
  assert.equal(req.membership, undefined);
});

test('organization profile access ignores spoofed request platformRole and requires persisted Platform Admin authority', async () => {
  const middleware = createOrganizationProfileAccessMiddleware({
    allowedOrganizationRoles: [
      ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    ],
    memberRepository: {
      async getByOrganizationAndUser() {
        return null;
      },
    },
    userRepository: {
      async getById(userId) {
        return {
          userId,
          email: 'normal@example.com',
          name: 'Normal User',
          status: USER_STATUS.ACTIVE,
          platformRole: null,
        };
      },
    },
  });
  const req = {
    user: {
      userId: 'user-1',
      platformRole: PLATFORM_ROLE.PLATFORM_ADMIN,
    },
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].code, 'MEMBERSHIP_REQUIRED');
  assert.equal(req.membership, undefined);
});

test('organization profile access accepts allowed active membership without requiring platform role', async () => {
  let userLookups = 0;
  const membership = {
    organizationId: 'org-1',
    userId: 'staff-1',
    role: ORGANIZATION_ROLE.STAFF,
    status: MEMBERSHIP_STATUS.ACTIVE,
  };
  const middleware = createOrganizationProfileAccessMiddleware({
    allowedOrganizationRoles: [
      ORGANIZATION_ROLE.STAFF,
      ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    ],
    memberRepository: {
      async getByOrganizationAndUser() {
        return membership;
      },
    },
    userRepository: {
      async getById() {
        userLookups += 1;
        return null;
      },
    },
  });
  const req = {
    user: {
      userId: 'staff-1',
      platformRole: null,
    },
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.deepEqual(recorder.calls, [undefined]);
  assert.equal(req.membership, membership);
  assert.equal(userLookups, 0);
});

test('organization profile update access rejects Staff and inactive membership without persisted Platform Admin role', async () => {
  for (const membership of [
    {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.STAFF,
      status: MEMBERSHIP_STATUS.ACTIVE,
    },
    {
      organizationId: 'org-1',
      userId: 'user-1',
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      status: MEMBERSHIP_STATUS.INACTIVE,
    },
  ]) {
    const middleware = createOrganizationProfileAccessMiddleware({
      allowedOrganizationRoles: [
        ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
      ],
      memberRepository: {
        async getByOrganizationAndUser() {
          return membership;
        },
      },
      userRepository: {
        async getById(userId) {
          return {
            userId,
            status: USER_STATUS.ACTIVE,
            platformRole: null,
          };
        },
      },
    });
    const req = {
      user: {
        userId: 'user-1',
      },
      organization: {
        organizationId: 'org-1',
        status: ORGANIZATION_STATUS.ACTIVE,
      },
    };
    const recorder = createNextRecorder();

    await middleware(req, {}, recorder.next);

    assert.equal(recorder.calls.length, 1);
    assert.equal(
      recorder.calls[0].code,
      membership.status === MEMBERSHIP_STATUS.ACTIVE
        ? 'ROLE_FORBIDDEN'
        : 'MEMBERSHIP_REQUIRED',
    );
  }
});

test('organization profile access fails closed on cross-tenant membership data', async () => {
  let userLookups = 0;
  const middleware = createOrganizationProfileAccessMiddleware({
    allowedOrganizationRoles: [
      ORGANIZATION_ROLE.STAFF,
      ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    ],
    memberRepository: {
      async getByOrganizationAndUser() {
        return {
          organizationId: 'org-other',
          userId: 'platform-1',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
      },
    },
    userRepository: {
      async getById() {
        userLookups += 1;
        return {
          userId: 'platform-1',
          status: USER_STATUS.ACTIVE,
          platformRole: PLATFORM_ROLE.PLATFORM_ADMIN,
        };
      },
    },
  });
  const req = {
    user: {
      userId: 'platform-1',
    },
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].code, 'TENANT_MISMATCH');
  assert.equal(userLookups, 0);
});

test('tenant membership middleware remains strict even when request user is a Platform Admin', async () => {
  const middleware = createOrganizationMembershipMiddleware({
    memberRepository: {
      async getByOrganizationAndUser() {
        return null;
      },
    },
  });
  const req = {
    user: {
      userId: 'platform-1',
      platformRole: PLATFORM_ROLE.PLATFORM_ADMIN,
    },
    organization: {
      organizationId: 'org-1',
      status: ORGANIZATION_STATUS.ACTIVE,
    },
  };
  const recorder = createNextRecorder();

  await middleware(req, {}, recorder.next);

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].code, 'MEMBERSHIP_REQUIRED');
  assert.equal(req.membership, undefined);
});
