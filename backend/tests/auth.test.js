'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createAuthService } = require('../src/modules/auth/auth.service');
const {
  createJwtService,
  requireJwtSecret,
} = require('../src/modules/auth/jwt.service');
const {
  createPasswordService,
} = require('../src/modules/auth/password.service');
const { normalizeEmail } = require('../src/modules/auth/auth.utils');
const { toUserDto } = require('../src/modules/users/user.mapper');
const {
  createUserRepository,
} = require('../src/modules/users/user.repository');

const FIXED_TIME = '2026-09-29T07:30:00.000Z';

function makeUser(overrides = {}) {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'student@example.com',
    passwordHash: '$2b$04$example-hash',
    name: 'Example User',
    status: 'ACTIVE',
    platformRole: null,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function makeAuthService(overrides = {}) {
  const calls = {
    findByEmail: [],
    createUserWithPlatformLink: [],
    hash: [],
    verify: [],
    issue: [],
  };

  const userRepository = {
    async findByEmail(email) {
      calls.findByEmail.push(email);
      return overrides.existingUser ?? null;
    },
    async createUserWithPlatformLink(user) {
      calls.createUserWithPlatformLink.push(user);
      return user;
    },
  };

  const passwordService = {
    async hash(password) {
      calls.hash.push(password);
      return overrides.passwordHash ?? 'hashed-password';
    },
    async verify(password, passwordHash) {
      calls.verify.push({ password, passwordHash });
      return overrides.passwordMatches ?? true;
    },
  };

  const jwtService = {
    expiresIn: '1d',
    issue(user) {
      calls.issue.push(user);
      return 'signed-test-token';
    },
  };

  const service = createAuthService({
    userRepository,
    passwordService,
    jwtService,
    idFactory: () => '22222222-2222-4222-8222-222222222222',
    clock: () => FIXED_TIME,
  });

  return { service, calls };
}

test('normalizeEmail trims whitespace and lowercases the address', () => {
  assert.equal(
    normalizeEmail('  Student.Example@KMITL.AC.TH  '),
    'student.example@kmitl.ac.th',
  );
  assert.equal(normalizeEmail(undefined), '');
});

test('password service hashes passwords and verifies without storing plaintext', async () => {
  const passwordService = createPasswordService({ rounds: 4 });
  const password = 'correct-horse-battery-staple';

  const passwordHash = await passwordService.hash(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^\$2[aby]\$/);
  assert.equal(await passwordService.verify(password, passwordHash), true);
  assert.equal(await passwordService.verify('wrong-password', passwordHash), false);
});

test('JWT issue includes minimum claims but no role or password data', () => {
  const service = createJwtService({
    secret: 'unit-test-jwt-secret',
    expiresIn: '1d',
  });
  const user = makeUser({
    platformRole: 'PLATFORM_ADMIN',
  });

  const token = service.issue(user);
  const decoded = jwt.decode(token);

  assert.equal(decoded.sub, user.userId);
  assert.equal(decoded.email, user.email);
  assert.equal(typeof decoded.iat, 'number');
  assert.equal(typeof decoded.exp, 'number');
  assert.equal(decoded.exp > decoded.iat, true);
  assert.equal('platformRole' in decoded, false);
  assert.equal('role' in decoded, false);
  assert.equal('status' in decoded, false);
  assert.equal('passwordHash' in decoded, false);
});

test('JWT verify distinguishes expired and invalid tokens', () => {
  const secret = 'unit-test-jwt-secret';
  const service = createJwtService({
    secret,
    expiresIn: '1d',
  });
  const expired = jwt.sign(
    {
      sub: 'user-1',
      email: 'student@example.com',
    },
    secret,
    { expiresIn: -1 },
  );

  assert.throws(
    () => service.verify(expired),
    (error) => error.code === 'TOKEN_EXPIRED' && error.httpStatus === 401,
  );

  assert.throws(
    () => service.verify('not-a-jwt'),
    (error) => error.code === 'TOKEN_INVALID' && error.httpStatus === 401,
  );
});

test('JWT service refuses to operate without JWT_SECRET', () => {
  assert.throws(
    () => requireJwtSecret(''),
    (error) =>
      error.code === 'CONFIG_MISSING' &&
      error.message === 'JWT_SECRET is required for JWT operations',
  );
});

test('register normalizes email, hashes password and returns sanitized user plus token', async () => {
  const { service, calls } = makeAuthService();

  const result = await service.register({
    email: '  Student@Example.COM ',
    password: 'example-password',
    name: 'Example User',
  });

  assert.deepEqual(calls.findByEmail, ['student@example.com']);
  assert.deepEqual(calls.hash, ['example-password']);
  assert.equal(calls.createUserWithPlatformLink.length, 1);

  const persistedUser = calls.createUserWithPlatformLink[0];
  assert.equal(persistedUser.email, 'student@example.com');
  assert.equal(persistedUser.passwordHash, 'hashed-password');
  assert.equal(persistedUser.status, 'ACTIVE');
  assert.equal(persistedUser.platformRole, null);
  assert.equal(persistedUser.createdAt, FIXED_TIME);
  assert.equal(persistedUser.updatedAt, FIXED_TIME);

  assert.equal(result.token, 'signed-test-token');
  assert.equal(result.expiresIn, '1d');
  assert.equal(result.user.email, 'student@example.com');
  assert.equal('passwordHash' in result.user, false);
  assert.equal('PK' in result.user, false);
  assert.equal('SK' in result.user, false);
});

test('register rejects duplicate email before hashing or writing a user', async () => {
  const { service, calls } = makeAuthService({
    existingUser: makeUser(),
  });

  await assert.rejects(
    service.register({
      email: 'Student@Example.com',
      password: 'example-password',
      name: 'Example User',
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.httpStatus === 409 &&
      error.message === 'Email is already registered',
  );

  assert.equal(calls.hash.length, 0);
  assert.equal(calls.createUserWithPlatformLink.length, 0);
});

test('login returns the same INVALID_CREDENTIALS response for unknown email and wrong password', async () => {
  const missing = makeAuthService({ existingUser: null });

  await assert.rejects(
    missing.service.login({
      email: 'missing@example.com',
      password: 'example-password',
    }),
    (error) =>
      error.code === 'INVALID_CREDENTIALS' &&
      error.httpStatus === 401 &&
      error.message === 'Invalid email or password',
  );

  const wrongPassword = makeAuthService({
    existingUser: makeUser(),
    passwordMatches: false,
  });

  await assert.rejects(
    wrongPassword.service.login({
      email: 'student@example.com',
      password: 'wrong-password',
    }),
    (error) =>
      error.code === 'INVALID_CREDENTIALS' &&
      error.httpStatus === 401 &&
      error.message === 'Invalid email or password',
  );
});

test('login rejects disabled users without issuing a JWT', async () => {
  const { service, calls } = makeAuthService({
    existingUser: makeUser({ status: 'DISABLED' }),
  });

  await assert.rejects(
    service.login({
      email: 'student@example.com',
      password: 'example-password',
    }),
    (error) =>
      error.code === 'USER_DISABLED' &&
      error.httpStatus === 403,
  );

  assert.equal(calls.verify.length, 0);
  assert.equal(calls.issue.length, 0);
});

test('login verifies the stored password hash and sanitizes the returned user', async () => {
  const user = makeUser({
    passwordHash: 'stored-password-hash',
  });
  const { service, calls } = makeAuthService({
    existingUser: user,
    passwordMatches: true,
  });

  const result = await service.login({
    email: ' STUDENT@example.com ',
    password: 'example-password',
  });

  assert.deepEqual(calls.findByEmail, ['student@example.com']);
  assert.deepEqual(calls.verify, [
    {
      password: 'example-password',
      passwordHash: 'stored-password-hash',
    },
  ]);
  assert.equal(result.token, 'signed-test-token');
  assert.equal('passwordHash' in result.user, false);
});

test('User DTO never exposes passwordHash or DynamoDB storage keys', () => {
  const dto = toUserDto({
    ...makeUser(),
    PK: 'USER#user-1',
    SK: 'PROFILE',
    GSI1PK: 'EMAIL#student@example.com',
    GSI1SK: 'USER#user-1',
  });

  assert.deepEqual(dto, {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'student@example.com',
    name: 'Example User',
    status: 'ACTIVE',
    platformRole: null,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  });
});

test('User repository writes User and PlatformUserLink in one transaction', async () => {
  const calls = [];
  const repository = {
    async transactWrite(input) {
      calls.push(input);
    },
  };
  const userRepository = createUserRepository({ repository });
  const user = makeUser({
    userId: '33333333-3333-4333-8333-333333333333',
  });

  await userRepository.createUserWithPlatformLink(user);

  assert.equal(calls.length, 1);
  const [userWrite, linkWrite] = calls[0].TransactItems;

  assert.equal(userWrite.Put.Item.PK, 'USER#33333333-3333-4333-8333-333333333333');
  assert.equal(userWrite.Put.Item.SK, 'PROFILE');
  assert.equal(userWrite.Put.Item.GSI1PK, 'EMAIL#student@example.com');
  assert.equal(userWrite.Put.Item.GSI1SK, 'USER#33333333-3333-4333-8333-333333333333');
  assert.equal(userWrite.Put.Item.passwordHash, user.passwordHash);

  assert.equal(linkWrite.Put.Item.PK, 'PLATFORM#USERS');
  assert.equal(
    linkWrite.Put.Item.SK,
    `USER#${FIXED_TIME}#33333333-3333-4333-8333-333333333333`,
  );
  assert.equal('passwordHash' in linkWrite.Put.Item, false);
});

test('register HTTP route validates request and returns canonical success envelope', async () => {
  const authService = {
    async register(input) {
      assert.deepEqual(input, {
        email: 'student@example.com',
        password: 'example-password',
        name: 'Example User',
      });

      return {
        user: toUserDto(makeUser()),
        token: 'signed-token',
        expiresIn: '1d',
      };
    },
    async login() {
      throw new Error('not used');
    },
  };

  const response = await request(
    createApp({
      auth: { authService },
    }),
  )
    .post('/api/v1/auth/register')
    .send({
      email: ' STUDENT@EXAMPLE.COM ',
      password: 'example-password',
      name: '  Example User  ',
    })
    .expect(201);

  assert.deepEqual(response.body, {
    success: true,
    data: {
      user: toUserDto(makeUser()),
      token: 'signed-token',
      expiresIn: '1d',
    },
  });
});

test('auth HTTP routes reject invalid password length with VALIDATION_ERROR', async () => {
  const response = await request(createApp())
    .post('/api/v1/auth/register')
    .send({
      email: 'student@example.com',
      password: 'short',
      name: 'Example User',
    })
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(
    response.body.error.message,
    'Password must be between 8 and 72 UTF-8 bytes',
  );
});

test('GET /api/v1/me reloads the current user and memberships and returns sanitized data', async () => {
  const secret = 'me-route-secret';
  const jwtService = createJwtService({
    secret,
    expiresIn: '1d',
  });
  const user = makeUser({
    userId: '44444444-4444-4444-8444-444444444444',
    platformRole: 'PLATFORM_ADMIN',
  });
  const token = jwtService.issue(user);

  const userRepository = {
    async getById(userId) {
      assert.equal(userId, user.userId);
      return {
        ...user,
        PK: `USER#${user.userId}`,
        SK: 'PROFILE',
      };
    },
  };

  const memberRepository = {
    async listForUser(userId) {
      assert.equal(userId, user.userId);
      return [
        {
          PK: 'ORG#org-1',
          SK: `MEMBER#${user.userId}`,
          organizationId: 'org-1',
          userId: user.userId,
          role: 'ORGANIZATION_ADMIN',
          status: 'ACTIVE',
          internalSecret: 'must-not-leak',
        },
        {
          organizationId: 'org-2',
          userId: user.userId,
          role: 'STAFF',
          status: 'INACTIVE',
        },
      ];
    },
  };

  const response = await request(
    createApp({
      users: {
        authOptions: {
          jwtService,
          userRepository,
        },
        memberRepository,
      },
    }),
  )
    .get('/api/v1/me')
    .set('authorization', `Bearer ${token}`)
    .expect(200);

  assert.deepEqual(response.body, {
    success: true,
    data: {
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        status: 'ACTIVE',
        platformRole: 'PLATFORM_ADMIN',
      },
      memberships: [
        {
          organizationId: 'org-1',
          role: 'ORGANIZATION_ADMIN',
          status: 'ACTIVE',
        },
        {
          organizationId: 'org-2',
          role: 'STAFF',
          status: 'INACTIVE',
        },
      ],
    },
  });

  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('internalSecret'), false);
  assert.equal(serialized.includes('"PK"'), false);
  assert.equal(serialized.includes('"SK"'), false);
});

test('GET /api/v1/me requires a valid Bearer token', async () => {
  const response = await request(
    createApp({
      users: {
        authOptions: {
          jwtService: {
            verify() {
              throw new Error('should not be called');
            },
          },
          userRepository: {
            async getById() {
              throw new Error('should not be called');
            },
          },
        },
        memberRepository: {
          async listForUser() {
            throw new Error('should not be called');
          },
        },
      },
    }),
  )
    .get('/api/v1/me')
    .expect(401);

  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    },
  });
});

test('GET /api/v1/me rejects tokens whose user no longer exists', async () => {
  const response = await request(
    createApp({
      users: {
        authOptions: {
          jwtService: {
            verify() {
              return {
                sub: 'deleted-user',
                email: 'deleted@example.com',
              };
            },
          },
          userRepository: {
            async getById() {
              return null;
            },
          },
        },
        memberRepository: {
          async listForUser() {
            return [];
          },
        },
      },
    }),
  )
    .get('/api/v1/me')
    .set('authorization', 'Bearer test-token')
    .expect(401);

  assert.equal(response.body.error.code, 'TOKEN_INVALID');
});

test('GET /api/v1/me rejects a disabled user even when JWT is otherwise valid', async () => {
  const response = await request(
    createApp({
      users: {
        authOptions: {
          jwtService: {
            verify() {
              return {
                sub: 'disabled-user',
                email: 'disabled@example.com',
              };
            },
          },
          userRepository: {
            async getById() {
              return makeUser({
                userId: 'disabled-user',
                email: 'disabled@example.com',
                status: 'DISABLED',
              });
            },
          },
        },
        memberRepository: {
          async listForUser() {
            return [];
          },
        },
      },
    }),
  )
    .get('/api/v1/me')
    .set('authorization', 'Bearer test-token')
    .expect(403);

  assert.equal(response.body.error.code, 'USER_DISABLED');
});
