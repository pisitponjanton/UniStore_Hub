'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  createOrganizationService,
} = require('../src/modules/organizations/organization.service');
const {
  createMemberService,
} = require('../src/modules/members/member.service');
const {
  toMemberDto,
} = require('../src/modules/members/member.mapper');
const {
  MEMBERSHIP_STATUS,
  ORGANIZATION_ROLE,
} = require('../src/modules/members/member.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');

const FIXED_TIME = '2026-09-29T09:45:00.000Z';

function createRepositoryRecorder() {
  const transactions = [];

  return {
    transactions,
    async transactWrite(input) {
      transactions.push(input);
      return {};
    },
  };
}

function createIdFactory(ids) {
  let index = 0;

  return () => {
    const value = ids[index];
    index += 1;
    return value;
  };
}

function makeOrganization(overrides = {}) {
  return {
    organizationId: 'org-1',
    name: 'IT Club Store',
    description: 'Student club merchandise',
    status: ORGANIZATION_STATUS.PENDING,
    createdBy: 'user-admin',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeMembership(overrides = {}) {
  return {
    organizationId: 'org-1',
    userId: 'user-admin',
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    status: MEMBERSHIP_STATUS.ACTIVE,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeUser(overrides = {}) {
  return {
    userId: 'user-staff',
    email: 'staff@example.com',
    name: 'Staff User',
    status: 'ACTIVE',
    platformRole: null,
    passwordHash: 'must-not-leak',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

test('organization creation writes Organization, creator admin membership and audit atomically', async () => {
  const repository = createRepositoryRecorder();
  const service = createOrganizationService({
    repository,
    idFactory: createIdFactory(['org-created', 'audit-created']),
    clock: () => FIXED_TIME,
  });

  const result = await service.createOrganization({
    name: 'IT Club Store',
    description: 'Student club merchandise',
    actorId: 'creator-1',
  });

  assert.equal(repository.transactions.length, 1);
  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 3);

  const organization = items[0].Put.Item;
  assert.deepEqual(
    {
      PK: organization.PK,
      SK: organization.SK,
      GSI1PK: organization.GSI1PK,
      GSI1SK: organization.GSI1SK,
      organizationId: organization.organizationId,
      status: organization.status,
      createdBy: organization.createdBy,
    },
    {
      PK: 'ORG#org-created',
      SK: 'PROFILE',
      GSI1PK: 'ORGS',
      GSI1SK: `CREATED#${FIXED_TIME}#ORG#org-created`,
      organizationId: 'org-created',
      status: ORGANIZATION_STATUS.PENDING,
      createdBy: 'creator-1',
    },
  );

  const membership = items[1].Put.Item;
  assert.equal(membership.PK, 'ORG#org-created');
  assert.equal(membership.SK, 'MEMBER#creator-1');
  assert.equal(membership.GSI1PK, 'USER#creator-1');
  assert.equal(membership.GSI1SK, 'ORG#org-created');
  assert.equal(membership.role, ORGANIZATION_ROLE.ORGANIZATION_ADMIN);
  assert.equal(membership.status, MEMBERSHIP_STATUS.ACTIVE);

  const audit = items[2].Put.Item;
  assert.equal(audit.action, 'ORGANIZATION_CREATED');
  assert.equal(audit.organizationId, 'org-created');
  assert.equal(audit.actorId, 'creator-1');
  assert.equal(audit.resourceType, 'ORGANIZATION');
  assert.equal(audit.resourceId, 'org-created');

  assert.deepEqual(result, {
    organizationId: 'org-created',
    name: 'IT Club Store',
    description: 'Student club merchandise',
    status: ORGANIZATION_STATUS.PENDING,
    createdBy: 'creator-1',
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });
});

test('organization list includes only organizations reached through active memberships', async () => {
  const requestedOrganizations = [];
  const service = createOrganizationService({
    memberRepository: {
      async listForUser(userId) {
        assert.equal(userId, 'user-1');
        return [
          makeMembership({
            organizationId: 'org-active',
            userId: 'user-1',
            status: MEMBERSHIP_STATUS.ACTIVE,
          }),
          makeMembership({
            organizationId: 'org-inactive',
            userId: 'user-1',
            status: MEMBERSHIP_STATUS.INACTIVE,
          }),
        ];
      },
    },
    organizationRepository: {
      async getById(organizationId) {
        requestedOrganizations.push(organizationId);
        return makeOrganization({ organizationId });
      },
    },
  });

  const organizations =
    await service.listAccessibleOrganizations('user-1');

  assert.deepEqual(requestedOrganizations, ['org-active']);
  assert.equal(organizations.length, 1);
  assert.equal(organizations[0].organizationId, 'org-active');
  assert.equal('PK' in organizations[0], false);
});

test('organization update writes changed fields and ORGANIZATION_UPDATED audit in one transaction', async () => {
  const repository = createRepositoryRecorder();
  const existing = makeOrganization({
    status: ORGANIZATION_STATUS.ACTIVE,
  });
  const service = createOrganizationService({
    repository,
    organizationRepository: {
      async getById(organizationId) {
        assert.equal(organizationId, 'org-1');
        return existing;
      },
    },
    idFactory: createIdFactory(['audit-update']),
    clock: () => FIXED_TIME,
  });

  const result = await service.updateOrganization({
    organizationId: 'org-1',
    actorId: 'user-admin',
    changes: {
      name: 'Updated Store',
      description: 'Updated description',
    },
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);

  const update = items[0].Update;
  assert.deepEqual(update.Key, {
    PK: 'ORG#org-1',
    SK: 'PROFILE',
  });
  assert.equal(update.ExpressionAttributeValues[':name'], 'Updated Store');
  assert.equal(
    update.ExpressionAttributeValues[':description'],
    'Updated description',
  );
  assert.equal(
    update.ExpressionAttributeValues[':updatedAt'],
    FIXED_TIME,
  );

  const audit = items[1].Put.Item;
  assert.equal(audit.action, 'ORGANIZATION_UPDATED');
  assert.deepEqual(audit.metadata.fields, ['name', 'description']);

  assert.equal(result.name, 'Updated Store');
  assert.equal(result.description, 'Updated description');
  assert.equal(result.status, ORGANIZATION_STATUS.ACTIVE);
  assert.equal(result.updatedAt, FIXED_TIME);
});

test('organization update returns ORGANIZATION_NOT_FOUND when target is missing', async () => {
  const service = createOrganizationService({
    organizationRepository: {
      async getById() {
        return null;
      },
    },
  });

  await assert.rejects(
    service.updateOrganization({
      organizationId: 'missing',
      actorId: 'user-admin',
      changes: { name: 'Updated' },
    }),
    (error) =>
      error.code === 'ORGANIZATION_NOT_FOUND' &&
      error.httpStatus === 404,
  );
});

test('member list joins sanitized user summary without password fields', async () => {
  const service = createMemberService({
    memberRepository: {
      async listByOrganization(organizationId) {
        assert.equal(organizationId, 'org-1');
        return [
          makeMembership({
            userId: 'user-staff',
            role: ORGANIZATION_ROLE.STAFF,
          }),
        ];
      },
    },
    userRepository: {
      async getById(userId) {
        assert.equal(userId, 'user-staff');
        return makeUser();
      },
    },
  });

  const members = await service.listMembers('org-1');

  assert.deepEqual(members, [
    {
      organizationId: 'org-1',
      userId: 'user-staff',
      role: ORGANIZATION_ROLE.STAFF,
      status: MEMBERSHIP_STATUS.ACTIVE,
      user: {
        userId: 'user-staff',
        email: 'staff@example.com',
        name: 'Staff User',
      },
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    },
  ]);
  assert.equal(JSON.stringify(members).includes('passwordHash'), false);
});

test('add member resolves existing user by normalized email and writes membership plus audit', async () => {
  const repository = createRepositoryRecorder();
  const lookedUpEmails = [];
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser(organizationId, userId) {
        assert.equal(organizationId, 'org-1');
        assert.equal(userId, 'user-staff');
        return null;
      },
    },
    userRepository: {
      async findByEmail(email) {
        lookedUpEmails.push(email);
        return makeUser();
      },
    },
    idFactory: createIdFactory(['audit-add']),
    clock: () => FIXED_TIME,
  });

  const member = await service.addMember({
    organizationId: 'org-1',
    actorId: 'user-admin',
    email: 'staff@example.com',
    role: ORGANIZATION_ROLE.STAFF,
  });

  assert.deepEqual(lookedUpEmails, ['staff@example.com']);
  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);

  const membership = items[0].Put.Item;
  assert.equal(membership.PK, 'ORG#org-1');
  assert.equal(membership.SK, 'MEMBER#user-staff');
  assert.equal(membership.GSI1PK, 'USER#user-staff');
  assert.equal(membership.GSI1SK, 'ORG#org-1');
  assert.equal(membership.status, MEMBERSHIP_STATUS.ACTIVE);
  assert.equal(membership.role, ORGANIZATION_ROLE.STAFF);

  const audit = items[1].Put.Item;
  assert.equal(audit.action, 'MEMBER_ADDED');
  assert.equal(audit.actorId, 'user-admin');
  assert.equal(audit.resourceId, 'user-staff');
  assert.deepEqual(audit.metadata, {
    role: ORGANIZATION_ROLE.STAFF,
  });

  assert.equal(member.user.email, 'staff@example.com');
  assert.equal('passwordHash' in member.user, false);
});

test('add member returns USER_NOT_FOUND and performs no write for unknown email', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    userRepository: {
      async findByEmail() {
        return null;
      },
    },
    memberRepository: {
      async getByOrganizationAndUser() {
        throw new Error('must not run');
      },
    },
  });

  await assert.rejects(
    service.addMember({
      organizationId: 'org-1',
      actorId: 'user-admin',
      email: 'missing@example.com',
      role: ORGANIZATION_ROLE.STAFF,
    }),
    (error) =>
      error.code === 'USER_NOT_FOUND' &&
      error.httpStatus === 404,
  );

  assert.equal(repository.transactions.length, 0);
});

test('adding an inactive former member reactivates the same membership and audits the action', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    userRepository: {
      async findByEmail() {
        return makeUser();
      },
    },
    memberRepository: {
      async getByOrganizationAndUser() {
        return makeMembership({
          userId: 'user-staff',
          role: ORGANIZATION_ROLE.STAFF,
          status: MEMBERSHIP_STATUS.INACTIVE,
        });
      },
    },
    idFactory: createIdFactory(['audit-reactivate']),
    clock: () => FIXED_TIME,
  });

  const result = await service.addMember({
    organizationId: 'org-1',
    actorId: 'user-admin',
    email: 'staff@example.com',
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items[0].Update.Key.PK, 'ORG#org-1');
  assert.equal(items[0].Update.Key.SK, 'MEMBER#user-staff');
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':active'],
    MEMBERSHIP_STATUS.ACTIVE,
  );
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':role'],
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  assert.equal(items[1].Put.Item.action, 'MEMBER_ADDED');
  assert.equal(result.status, MEMBERSHIP_STATUS.ACTIVE);
  assert.equal(result.role, ORGANIZATION_ROLE.ORGANIZATION_ADMIN);
});

test('member role update writes conditional change and MEMBER_ROLE_UPDATED audit', async () => {
  const repository = createRepositoryRecorder();
  const current = makeMembership({
    userId: 'user-staff',
    role: ORGANIZATION_ROLE.STAFF,
  });
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser() {
        return current;
      },
    },
    userRepository: {
      async getById() {
        return makeUser();
      },
    },
    idFactory: createIdFactory(['audit-role']),
    clock: () => FIXED_TIME,
  });

  const result = await service.updateRole({
    organizationId: 'org-1',
    userId: 'user-staff',
    actorId: 'user-admin',
    role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  });

  const items = repository.transactions[0].TransactItems;
  const update = items[0].Update;
  assert.equal(update.Key.SK, 'MEMBER#user-staff');
  assert.equal(
    update.ExpressionAttributeValues[':currentRole'],
    ORGANIZATION_ROLE.STAFF,
  );
  assert.equal(
    update.ExpressionAttributeValues[':role'],
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );

  const audit = items[1].Put.Item;
  assert.equal(audit.action, 'MEMBER_ROLE_UPDATED');
  assert.deepEqual(audit.metadata, {
    fromRole: ORGANIZATION_ROLE.STAFF,
    toRole: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  });

  assert.equal(result.role, ORGANIZATION_ROLE.ORGANIZATION_ADMIN);
});

test('demoting the final active Organization Admin fails with LAST_ORGANIZATION_ADMIN', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser() {
        return makeMembership({
          userId: 'admin-only',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
        });
      },
      async listByOrganization() {
        return [
          makeMembership({
            userId: 'admin-only',
            role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          }),
          makeMembership({
            userId: 'staff-1',
            role: ORGANIZATION_ROLE.STAFF,
          }),
        ];
      },
    },
  });

  await assert.rejects(
    service.updateRole({
      organizationId: 'org-1',
      userId: 'admin-only',
      actorId: 'admin-only',
      role: ORGANIZATION_ROLE.STAFF,
    }),
    (error) =>
      error.code === 'LAST_ORGANIZATION_ADMIN' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('demoting an admin is allowed when another active Organization Admin exists and transaction checks witness', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser() {
        return makeMembership({
          userId: 'admin-1',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
        });
      },
      async listByOrganization() {
        return [
          makeMembership({
            userId: 'admin-1',
            role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          }),
          makeMembership({
            userId: 'admin-2',
            role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          }),
        ];
      },
    },
    userRepository: {
      async getById() {
        return makeUser({ userId: 'admin-1' });
      },
    },
    idFactory: createIdFactory(['audit-demote']),
    clock: () => FIXED_TIME,
  });

  await service.updateRole({
    organizationId: 'org-1',
    userId: 'admin-1',
    actorId: 'admin-2',
    role: ORGANIZATION_ROLE.STAFF,
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 3);
  assert.deepEqual(items[0].ConditionCheck.Key, {
    PK: 'ORG#org-1',
    SK: 'MEMBER#admin-2',
  });
  assert.equal(
    items[0].ConditionCheck.ExpressionAttributeValues[':admin'],
    ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
  );
  assert.equal(items[2].Put.Item.action, 'MEMBER_ROLE_UPDATED');
});

test('removing a Staff member soft-deactivates membership and writes MEMBER_REMOVED audit', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser() {
        return makeMembership({
          userId: 'staff-1',
          role: ORGANIZATION_ROLE.STAFF,
        });
      },
    },
    idFactory: createIdFactory(['audit-remove']),
    clock: () => FIXED_TIME,
  });

  await service.removeMember({
    organizationId: 'org-1',
    userId: 'staff-1',
    actorId: 'user-admin',
  });

  const items = repository.transactions[0].TransactItems;
  assert.equal(items.length, 2);
  assert.equal(items[0].Update.Key.SK, 'MEMBER#staff-1');
  assert.equal(
    items[0].Update.ExpressionAttributeValues[':inactive'],
    MEMBERSHIP_STATUS.INACTIVE,
  );
  assert.equal(items[1].Put.Item.action, 'MEMBER_REMOVED');
  assert.equal(items[1].Put.Item.resourceId, 'staff-1');
});

test('removing the final active Organization Admin fails with LAST_ORGANIZATION_ADMIN', async () => {
  const repository = createRepositoryRecorder();
  const service = createMemberService({
    repository,
    memberRepository: {
      async getByOrganizationAndUser() {
        return makeMembership({
          userId: 'admin-only',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
        });
      },
      async listByOrganization() {
        return [
          makeMembership({
            userId: 'admin-only',
            role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          }),
        ];
      },
    },
  });

  await assert.rejects(
    service.removeMember({
      organizationId: 'org-1',
      userId: 'admin-only',
      actorId: 'admin-only',
    }),
    (error) =>
      error.code === 'LAST_ORGANIZATION_ADMIN' &&
      error.httpStatus === 409,
  );

  assert.equal(repository.transactions.length, 0);
});

test('member DTO exposes only canonical member and user summary fields', () => {
  const dto = toMemberDto(
    {
      ...makeMembership({
        userId: 'user-staff',
        role: ORGANIZATION_ROLE.STAFF,
      }),
      PK: 'ORG#org-1',
      SK: 'MEMBER#user-staff',
      GSI1PK: 'USER#user-staff',
      secret: 'must-not-leak',
    },
    {
      ...makeUser(),
      PK: 'USER#user-staff',
      SK: 'PROFILE',
    },
  );

  assert.deepEqual(dto, {
    organizationId: 'org-1',
    userId: 'user-staff',
    role: ORGANIZATION_ROLE.STAFF,
    status: MEMBERSHIP_STATUS.ACTIVE,
    user: {
      userId: 'user-staff',
      email: 'staff@example.com',
      name: 'Staff User',
    },
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });
});

test('member HTTP routes are denied when resolved membership role is STAFF even if client claims admin', async () => {
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'staff-caller',
          email: 'caller@example.com',
          status: 'ACTIVE',
          platformRole: null,
        };
        next();
      },
      organizationContextMiddleware(req, res, next) {
        req.organization = {
          organizationId: req.params.organizationId,
          status: ORGANIZATION_STATUS.ACTIVE,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'staff-caller',
          role: ORGANIZATION_ROLE.STAFF,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      members: {
        memberService: {
          async listMembers() {
            throw new Error('must not reach member service');
          },
        },
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/organizations/org-1/members')
    .set('authorization', 'Bearer ignored-by-test-middleware')
    .send({
      role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
    })
    .expect(403);

  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'ROLE_FORBIDDEN',
      message: 'Organization role does not permit this action',
    },
  });
});

test('Organization Admin can list member route and receives canonical list envelope', async () => {
  const app = createApp({
    organizations: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'admin-caller',
          email: 'admin@example.com',
          status: 'ACTIVE',
          platformRole: null,
        };
        next();
      },
      organizationContextMiddleware(req, res, next) {
        req.organization = {
          organizationId: req.params.organizationId,
          status: ORGANIZATION_STATUS.ACTIVE,
        };
        next();
      },
      membershipMiddleware(req, res, next) {
        req.membership = {
          organizationId: req.params.organizationId,
          userId: 'admin-caller',
          role: ORGANIZATION_ROLE.ORGANIZATION_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
        };
        next();
      },
      members: {
        memberService: {
          async listMembers(organizationId) {
            assert.equal(organizationId, 'org-1');
            return [
              {
                organizationId: 'org-1',
                userId: 'user-staff',
                role: ORGANIZATION_ROLE.STAFF,
                status: MEMBERSHIP_STATUS.ACTIVE,
                user: {
                  userId: 'user-staff',
                  email: 'staff@example.com',
                  name: 'Staff User',
                },
                createdAt: FIXED_TIME,
                updatedAt: FIXED_TIME,
              },
            ];
          },
        },
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/organizations/org-1/members')
    .set('authorization', 'Bearer ignored-by-test-middleware')
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.body.data.nextCursor, null);
  assert.equal(response.body.data.items[0].user.email, 'staff@example.com');
});
