'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const {
  createPlatformAdminMiddleware,
} = require('../src/middleware/platform-admin.middleware');
const {
  AUDIT_ACTION,
} = require('../src/modules/audit/audit.constants');
const {
  USER_STATUS,
} = require('../src/modules/auth/auth.constants');
const {
  ORGANIZATION_STATUS,
} = require('../src/modules/organizations/organization.constants');
const {
  createOrganizationRepository,
} = require('../src/modules/organizations/organization.repository');
const {
  PLATFORM_ROLE,
} = require('../src/modules/platform-admin/platform-admin.constants');
const {
  createPlatformAdminSeeder,
} = require('../src/modules/platform-admin/platform-admin.seed');
const {
  createPlatformAdminService,
} = require('../src/modules/platform-admin/platform-admin.service');
const {
  createUserRepository,
} = require('../src/modules/users/user.repository');

const FIXED_TIME = '2026-09-29T16:00:00.000Z';

function makeUser(overrides = {}) {
  return {
    PK: 'USER#user-1',
    SK: 'PROFILE',
    entityType: 'User',
    userId: 'user-1',
    email: 'admin@example.com',
    passwordHash: 'stored-password-hash',
    name: 'Platform Admin',
    status: USER_STATUS.ACTIVE,
    platformRole: PLATFORM_ROLE.PLATFORM_ADMIN,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makeOrganization(overrides = {}) {
  return {
    PK: 'ORG#org-1',
    SK: 'PROFILE',
    GSI1PK: 'ORGS',
    GSI1SK:
      'CREATED#2026-09-29T10:00:00.000Z#ORG#org-1',
    entityType: 'Organization',
    organizationId: 'org-1',
    name: 'Organization One',
    description: 'Test organization',
    status: ORGANIZATION_STATUS.PENDING,
    createdBy: 'user-creator',
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

function makePlatformUserLink(user, overrides = {}) {
  return {
    PK: 'PLATFORM#USERS',
    SK:
      `USER#${user.createdAt}#${user.userId}`,
    entityType: 'PlatformUserLink',
    userId: user.userId,
    status: user.status,
    createdAt: user.createdAt,
    ...overrides,
  };
}

function invokeMiddleware(middleware, req) {
  return new Promise((resolve, reject) => {
    middleware(
      req,
      {},
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(req);
      },
    );
  });
}

test('Platform Admin middleware reloads persisted User role instead of trusting request role claims', async () => {
  const calls = [];
  const middleware =
    createPlatformAdminMiddleware({
      userRepository: {
        async getById(userId) {
          calls.push(userId);
          return makeUser();
        },
      },
    });
  const req = {
    user: {
      userId: 'user-1',
      platformRole: null,
      organizationRole:
        'ORGANIZATION_ADMIN',
    },
  };

  await invokeMiddleware(
    middleware,
    req,
  );

  assert.deepEqual(calls, ['user-1']);
  assert.equal(
    req.user.platformRole,
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );
  assert.equal(
    Object.hasOwn(
      req.user,
      'organizationRole',
    ),
    false,
  );
});

test('Organization Admin is not a Platform Admin when persisted platformRole is null', async () => {
  const middleware =
    createPlatformAdminMiddleware({
      userRepository: {
        async getById() {
          return makeUser({
            platformRole: null,
          });
        },
      },
    });

  await assert.rejects(
    invokeMiddleware(middleware, {
      user: {
        userId: 'user-1',
        organizationRole:
          'ORGANIZATION_ADMIN',
        platformRole:
          PLATFORM_ROLE.PLATFORM_ADMIN,
      },
    }),
    (error) =>
      error.code === 'ROLE_FORBIDDEN' &&
      error.httpStatus === 403,
  );
});

test('disabled persisted Platform Admin is rejected', async () => {
  const middleware =
    createPlatformAdminMiddleware({
      userRepository: {
        async getById() {
          return makeUser({
            status: USER_STATUS.DISABLED,
          });
        },
      },
    });

  await assert.rejects(
    invokeMiddleware(middleware, {
      user: {
        userId: 'user-1',
      },
    }),
    (error) =>
      error.code === 'USER_DISABLED' &&
      error.httpStatus === 403,
  );
});

test('platform Organization repository uses ORGS GSI and never a table Scan', async () => {
  let seen;
  const repository =
    createOrganizationRepository({
      repository: {
        async query(input) {
          seen = input;
          return {
            items: [],
            lastEvaluatedKey: null,
          };
        },
      },
    });

  await repository.listPlatform({
    exclusiveStartKey: {
      GSI1PK: 'ORGS',
      GSI1SK: 'CREATED#cursor',
      PK: 'ORG#cursor',
      SK: 'PROFILE',
    },
  });

  assert.equal(seen.IndexName, 'GSI1');
  assert.equal(
    seen.ExpressionAttributeValues[
      ':gsi1pk'
    ],
    'ORGS',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':createdPrefix'
    ],
    'CREATED#',
  );
  assert.equal(
    Object.hasOwn(seen, 'Scan'),
    false,
  );
});

test('platform User repository lists PlatformUserLink partition without Scan', async () => {
  let seen;
  const repository = createUserRepository({
    repository: {
      async query(input) {
        seen = input;
        return {
          items: [],
          lastEvaluatedKey: null,
        };
      },
    },
  });

  await repository.listPlatformLinksPage({
    exclusiveStartKey: {
      PK: 'PLATFORM#USERS',
      SK: 'USER#cursor',
    },
  });

  assert.equal(
    seen.ExpressionAttributeValues[':pk'],
    'PLATFORM#USERS',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':userPrefix'
    ],
    'USER#',
  );
  assert.equal(
    seen.ExpressionAttributeValues[
      ':linkType'
    ],
    'PlatformUserLink',
  );
  assert.equal(
    Object.hasOwn(seen, 'Scan'),
    false,
  );
});

test('platform list Users resolves PlatformUserLink to sanitized UserDTO', async () => {
  const user = makeUser();
  const service =
    createPlatformAdminService({
      userRepository: {
        async listPlatformLinksPage({
          exclusiveStartKey,
        }) {
          assert.equal(
            exclusiveStartKey,
            undefined,
          );
          return {
            items: [
              makePlatformUserLink(user),
            ],
            lastEvaluatedKey: null,
          };
        },

        async getById(userId) {
          assert.equal(
            userId,
            user.userId,
          );
          return user;
        },
      },
      organizationRepository: {
        async listPlatform() {
          return {
            items: [],
            lastEvaluatedKey: null,
          };
        },
      },
    });

  const users = await service.listUsers();

  assert.deepEqual(users, [
    {
      userId: 'user-1',
      email: 'admin@example.com',
      name: 'Platform Admin',
      status: USER_STATUS.ACTIVE,
      platformRole:
        PLATFORM_ROLE.PLATFORM_ADMIN,
      createdAt:
        '2026-09-29T10:00:00.000Z',
      updatedAt:
        '2026-09-29T10:00:00.000Z',
    },
  ]);
  assert.equal(
    Object.hasOwn(users[0], 'passwordHash'),
    false,
  );
  assert.equal(
    Object.hasOwn(users[0], 'PK'),
    false,
  );
});

test('platform summary counts canonical Organization and User statuses across pages', async () => {
  const activeUser = makeUser();
  const disabledUser = makeUser({
    userId: 'user-2',
    email: 'disabled@example.com',
    status: USER_STATUS.DISABLED,
    platformRole: null,
    createdAt:
      '2026-09-29T11:00:00.000Z',
  });
  let orgPage = 0;
  let userPage = 0;
  const service =
    createPlatformAdminService({
      organizationRepository: {
        async listPlatform({
          exclusiveStartKey,
        }) {
          orgPage += 1;

          if (orgPage === 1) {
            assert.equal(
              exclusiveStartKey,
              undefined,
            );
            return {
              items: [
                makeOrganization(),
                makeOrganization({
                  organizationId: 'org-2',
                  status:
                    ORGANIZATION_STATUS.ACTIVE,
                }),
              ],
              lastEvaluatedKey: {
                GSI1PK: 'ORGS',
                GSI1SK: 'next',
              },
            };
          }

          return {
            items: [
              makeOrganization({
                organizationId: 'org-3',
                status:
                  ORGANIZATION_STATUS.SUSPENDED,
              }),
            ],
            lastEvaluatedKey: null,
          };
        },
      },
      userRepository: {
        async listPlatformLinksPage({
          exclusiveStartKey,
        }) {
          userPage += 1;

          if (userPage === 1) {
            assert.equal(
              exclusiveStartKey,
              undefined,
            );
            return {
              items: [
                makePlatformUserLink(
                  activeUser,
                ),
              ],
              lastEvaluatedKey: {
                PK: 'PLATFORM#USERS',
                SK: 'next',
              },
            };
          }

          return {
            items: [
              makePlatformUserLink(
                disabledUser,
              ),
            ],
            lastEvaluatedKey: null,
          };
        },

        async getById(userId) {
          return userId === 'user-1'
            ? activeUser
            : disabledUser;
        },
      },
    });

  const summary =
    await service.getSummary();

  assert.deepEqual(
    summary.organizationsByStatus,
    {
      [ORGANIZATION_STATUS.PENDING]: 1,
      [ORGANIZATION_STATUS.ACTIVE]: 1,
      [ORGANIZATION_STATUS.SUSPENDED]: 1,
    },
  );
  assert.deepEqual(
    summary.usersByStatus,
    {
      [USER_STATUS.ACTIVE]: 1,
      [USER_STATUS.DISABLED]: 1,
    },
  );
  assert.equal(orgPage, 2);
  assert.equal(userPage, 2);
});

test('approve Organization requires PENDING and writes Organization plus ORGANIZATION_APPROVED Audit atomically', async () => {
  const transactions = [];
  const service =
    createPlatformAdminService({
      clock: () => FIXED_TIME,
      idFactory: () => 'audit-1',
      repository: {
        async transactWrite(input) {
          transactions.push(input);
        },
      },
      organizationRepository: {
        async getById() {
          return makeOrganization();
        },
      },
    });

  const result =
    await service.approveOrganization({
      organizationId: 'org-1',
      actorId: 'platform-admin-1',
    });

  assert.equal(
    result.status,
    ORGANIZATION_STATUS.ACTIVE,
  );
  assert.equal(
    result.updatedAt,
    FIXED_TIME,
  );
  assert.equal(
    transactions.length,
    1,
  );

  const update =
    transactions[0].TransactItems[0]
      .Update;
  assert.deepEqual(update.Key, {
    PK: 'ORG#org-1',
    SK: 'PROFILE',
  });
  assert.equal(
    update.ExpressionAttributeValues[
      ':expectedStatus'
    ],
    ORGANIZATION_STATUS.PENDING,
  );
  assert.equal(
    update.ExpressionAttributeValues[
      ':toStatus'
    ],
    ORGANIZATION_STATUS.ACTIVE,
  );

  const audit =
    transactions[0].TransactItems[1]
      .Put.Item;
  assert.equal(
    audit.action,
    AUDIT_ACTION.ORGANIZATION_APPROVED,
  );
  assert.equal(
    audit.actorId,
    'platform-admin-1',
  );
  assert.deepEqual(audit.metadata, {
    fromStatus:
      ORGANIZATION_STATUS.PENDING,
    toStatus:
      ORGANIZATION_STATUS.ACTIVE,
  });
});

test('approve rejects non-PENDING Organization without writing', async () => {
  let writes = 0;
  const service =
    createPlatformAdminService({
      repository: {
        async transactWrite() {
          writes += 1;
        },
      },
      organizationRepository: {
        async getById() {
          return makeOrganization({
            status:
              ORGANIZATION_STATUS.ACTIVE,
          });
        },
      },
    });

  await assert.rejects(
    service.approveOrganization({
      organizationId: 'org-1',
      actorId: 'platform-admin-1',
    }),
    (error) =>
      error.code ===
        'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );

  assert.equal(writes, 0);
});

test('suspend Organization writes SUSPENDED status and ORGANIZATION_SUSPENDED Audit', async () => {
  const transactions = [];
  const service =
    createPlatformAdminService({
      clock: () => FIXED_TIME,
      idFactory: () => 'audit-2',
      repository: {
        async transactWrite(input) {
          transactions.push(input);
        },
      },
      organizationRepository: {
        async getById() {
          return makeOrganization({
            status:
              ORGANIZATION_STATUS.ACTIVE,
          });
        },
      },
    });

  const result =
    await service.suspendOrganization({
      organizationId: 'org-1',
      actorId: 'platform-admin-1',
    });

  assert.equal(
    result.status,
    ORGANIZATION_STATUS.SUSPENDED,
  );
  assert.equal(
    transactions[0].TransactItems[1]
      .Put.Item.action,
    AUDIT_ACTION.ORGANIZATION_SUSPENDED,
  );
});

test('duplicate suspend and concurrent status drift are rejected as INVALID_STATUS_TRANSITION', async () => {
  const alreadySuspended =
    createPlatformAdminService({
      organizationRepository: {
        async getById() {
          return makeOrganization({
            status:
              ORGANIZATION_STATUS.SUSPENDED,
          });
        },
      },
    });

  await assert.rejects(
    alreadySuspended.suspendOrganization({
      organizationId: 'org-1',
      actorId: 'platform-admin-1',
    }),
    (error) =>
      error.code ===
        'INVALID_STATUS_TRANSITION',
  );

  const conflict = new Error(
    'transaction conflict',
  );
  conflict.name =
    'TransactionCanceledException';
  conflict.CancellationReasons = [
    {
      Code: 'ConditionalCheckFailed',
    },
    {
      Code: 'None',
    },
  ];

  const concurrent =
    createPlatformAdminService({
      repository: {
        async transactWrite() {
          throw conflict;
        },
      },
      organizationRepository: {
        async getById() {
          return makeOrganization();
        },
      },
    });

  await assert.rejects(
    concurrent.approveOrganization({
      organizationId: 'org-1',
      actorId: 'platform-admin-1',
    }),
    (error) =>
      error.code ===
        'INVALID_STATUS_TRANSITION' &&
      error.httpStatus === 409,
  );
});

test('Platform Admin routes reload persisted platform role and expose canonical endpoints', async () => {
  const calls = [];
  const app = createApp({
    platformAdmin: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'user-1',
          platformRole: null,
        };
        next();
      },
      platformAdminOptions: {
        userRepository: {
          async getById() {
            return makeUser();
          },
        },
      },
      platformAdminService: {
        async listOrganizations() {
          calls.push('organizations');
          return [makeOrganization()];
        },
        async approveOrganization(input) {
          calls.push({
            approve: input,
          });
          return makeOrganization({
            status:
              ORGANIZATION_STATUS.ACTIVE,
          });
        },
        async suspendOrganization(input) {
          calls.push({
            suspend: input,
          });
          return makeOrganization({
            status:
              ORGANIZATION_STATUS.SUSPENDED,
          });
        },
        async listUsers() {
          calls.push('users');
          return [
            {
              userId: 'user-1',
              email: 'admin@example.com',
              name: 'Platform Admin',
              status: USER_STATUS.ACTIVE,
              platformRole:
                PLATFORM_ROLE.PLATFORM_ADMIN,
              createdAt:
                '2026-09-29T10:00:00.000Z',
              updatedAt:
                '2026-09-29T10:00:00.000Z',
            },
          ];
        },
        async getSummary() {
          calls.push('summary');
          return {
            organizationsByStatus: {
              PENDING: 1,
            },
            usersByStatus: {
              ACTIVE: 1,
            },
          };
        },
      },
    },
  });

  const organizations = await request(app)
    .get('/api/v1/platform/organizations')
    .expect(200);
  assert.equal(
    organizations.body.data.items.length,
    1,
  );

  await request(app)
    .post(
      '/api/v1/platform/organizations/org-1/approve',
    )
    .expect(200);

  await request(app)
    .post(
      '/api/v1/platform/organizations/org-1/suspend',
    )
    .expect(200);

  const users = await request(app)
    .get('/api/v1/platform/users')
    .expect(200);
  assert.equal(
    users.body.data.items[0].platformRole,
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );

  const summary = await request(app)
    .get('/api/v1/platform/summary')
    .expect(200);
  assert.deepEqual(summary.body.data, {
    organizationsByStatus: {
      PENDING: 1,
    },
    usersByStatus: {
      ACTIVE: 1,
    },
  });

  assert.deepEqual(calls, [
    'organizations',
    {
      approve: {
        organizationId: 'org-1',
        actorId: 'user-1',
      },
    },
    {
      suspend: {
        organizationId: 'org-1',
        actorId: 'user-1',
      },
    },
    'users',
    'summary',
  ]);
});

test('Organization Admin without persisted platformRole cannot access Platform Admin routes', async () => {
  let serviceCalled = false;
  const app = createApp({
    platformAdmin: {
      authMiddleware(req, res, next) {
        req.user = {
          userId: 'org-admin-1',
          organizationRole:
            'ORGANIZATION_ADMIN',
          platformRole:
            PLATFORM_ROLE.PLATFORM_ADMIN,
        };
        next();
      },
      platformAdminOptions: {
        userRepository: {
          async getById() {
            return makeUser({
              userId: 'org-admin-1',
              platformRole: null,
            });
          },
        },
      },
      platformAdminService: {
        async getSummary() {
          serviceCalled = true;
          return {};
        },
      },
    },
  });

  const response = await request(app)
    .get('/api/v1/platform/summary')
    .expect(403);

  assert.equal(
    response.body.error.code,
    'ROLE_FORBIDDEN',
  );
  assert.equal(serviceCalled, false);
});

test('platform admin seed creates missing User with hashed password and sanitized result', async () => {
  const calls = {
    hash: [],
    create: [],
  };
  const seeder =
    createPlatformAdminSeeder({
      idFactory: () => 'user-new',
      clock: () => FIXED_TIME,
      passwordService: {
        async hash(password) {
          calls.hash.push(password);
          return 'bcrypt-hash';
        },
      },
      userRepository: {
        async findByEmail(email) {
          assert.equal(
            email,
            'admin@example.com',
          );
          return null;
        },
        async createUserWithPlatformLink(
          user,
        ) {
          calls.create.push(user);
        },
      },
    });

  const result = await seeder.seed({
    email: ' Admin@Example.com ',
    password: 'example-password',
    name: ' Platform Admin ',
  });

  assert.deepEqual(calls.hash, [
    'example-password',
  ]);
  assert.equal(calls.create.length, 1);
  assert.equal(
    calls.create[0].passwordHash,
    'bcrypt-hash',
  );
  assert.equal(
    calls.create[0].platformRole,
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );
  assert.equal(
    calls.create[0].status,
    USER_STATUS.ACTIVE,
  );
  assert.equal(result.created, true);
  assert.equal(
    result.user.email,
    'admin@example.com',
  );
  assert.equal(
    Object.hasOwn(
      result.user,
      'passwordHash',
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(result.user, 'password'),
    false,
  );
});

test('platform admin seed upgrades existing User without hashing or changing existing password', async () => {
  const existing = makeUser({
    platformRole: null,
    passwordHash:
      'existing-password-hash',
  });
  let hashCalls = 0;
  let updateCall;
  const seeder =
    createPlatformAdminSeeder({
      clock: () => FIXED_TIME,
      passwordService: {
        async hash() {
          hashCalls += 1;
          return 'should-not-be-used';
        },
      },
      userRepository: {
        async findByEmail() {
          return existing;
        },
        async setPlatformRoleAndEnsureLink(
          user,
          changes,
        ) {
          updateCall = {
            user,
            changes,
          };
          return {
            ...user,
            ...changes,
          };
        },
      },
    });

  const result = await seeder.seed({
    email: 'admin@example.com',
    password: 'replacement-password',
    name: 'New Display Name',
  });

  assert.equal(hashCalls, 0);
  assert.equal(
    updateCall.user.passwordHash,
    'existing-password-hash',
  );
  assert.deepEqual(updateCall.changes, {
    platformRole:
      PLATFORM_ROLE.PLATFORM_ADMIN,
    updatedAt: FIXED_TIME,
  });
  assert.equal(result.created, false);
  assert.equal(
    result.user.platformRole,
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );
  assert.equal(
    Object.hasOwn(
      result.user,
      'passwordHash',
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(result.user, 'password'),
    false,
  );
});

test('setPlatformRoleAndEnsureLink updates only platform role/timestamp and re-puts canonical PlatformUserLink', async () => {
  const transactions = [];
  const repository = createUserRepository({
    repository: {
      async transactWrite(input) {
        transactions.push(input);
      },
    },
  });
  const user = makeUser({
    platformRole: null,
  });

  await repository.setPlatformRoleAndEnsureLink(
    user,
    {
      platformRole:
        PLATFORM_ROLE.PLATFORM_ADMIN,
      updatedAt: FIXED_TIME,
    },
  );

  const transaction = transactions[0];
  assert.equal(
    transaction.TransactItems.length,
    2,
  );
  const update =
    transaction.TransactItems[0].Update;
  assert.deepEqual(update.Key, {
    PK: 'USER#user-1',
    SK: 'PROFILE',
  });
  assert.equal(
    update.UpdateExpression.includes(
      'password',
    ),
    false,
  );
  assert.equal(
    update.ExpressionAttributeValues[
      ':platformRole'
    ],
    PLATFORM_ROLE.PLATFORM_ADMIN,
  );

  const link =
    transaction.TransactItems[1].Put.Item;
  assert.equal(
    link.PK,
    'PLATFORM#USERS',
  );
  assert.equal(
    link.SK,
    'USER#2026-09-29T10:00:00.000Z#user-1',
  );
  assert.equal(
    link.entityType,
    'PlatformUserLink',
  );
});

test('seed command source never writes the platform admin password to stdout or stderr', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      '../scripts/seed-platform-admin.js',
    ),
    'utf8',
  );

  assert.equal(
    source.includes(
      'PLATFORM_ADMIN_PASSWORD',
    ),
    true,
  );
  assert.equal(
    /stdout\.write\([^)]*password/i.test(
      source,
    ),
    false,
  );
  assert.equal(
    /stderr\.write\([^)]*password/i.test(
      source,
    ),
    false,
  );
});
