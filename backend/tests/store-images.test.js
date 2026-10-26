'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFileService } = require('../src/modules/files/file.service');
const {
  assertStoreImageKey, createStoreImageAssociationValidator,
} = require('../src/modules/files/file.validation');
const { createStoreService } = require('../src/modules/stores/store.service');
const { toStorefrontStoreDto } = require('../src/modules/storefront/storefront.mapper');

const ID = '11111111-1111-4111-8111-111111111111';
const ORG = 'org-1';
const STORE = 'store-1';
const key = `stores/${ORG}/${STORE}/${ID}`;
const store = {
  organizationId: ORG, storeId: STORE, name: 'Test shop', description: '',
  imageKey: null, status: 'ACTIVE',
  createdAt: '2026-10-26T00:00:00.000Z', updatedAt: '2026-10-26T00:00:00.000Z',
};

test('Store cover key must belong to the exact tenant and store', () => {
  assert.equal(assertStoreImageKey({ organizationId: ORG, storeId: STORE, objectKey: key }).kind, 'STORE_IMAGE');
  for (const candidate of [
    `stores/org-2/${STORE}/${ID}`,
    `stores/${ORG}/store-2/${ID}`,
    `products/${ORG}/${STORE}/${ID}`,
    `stores/${ORG}/${STORE}/../../secrets`,
  ]) {
    assert.throws(() => assertStoreImageKey({
      organizationId: ORG, storeId: STORE, objectKey: candidate,
    }), e => e.code === 'FILE_ACCESS_FORBIDDEN');
  }
});

test('Store cover association requires an existing valid S3 image object', async () => {
  const calls = [];
  const validator = createStoreImageAssociationValidator({ s3Adapter: {
    async headObject(args) { calls.push(args); return { ContentType: 'image/png', ContentLength: 42 }; },
  } });
  await validator({ organizationId: ORG, storeId: STORE, imageKey: key });
  assert.deepEqual(calls, [{ objectKey: key }]);
  await assert.rejects(
    validator({ organizationId: ORG, storeId: STORE, imageKey: `stores/${ORG}/bad-store/${ID}` }),
    e => e.code === 'FILE_ACCESS_FORBIDDEN',
  );
  const tooBig = createStoreImageAssociationValidator({ s3Adapter: {
    async headObject() { return { ContentType: 'image/png', ContentLength: 6 * 1024 * 1024 }; },
  } });
  await assert.rejects(tooBig({ organizationId: ORG, storeId: STORE, imageKey: key }),
    e => e.code === 'VALIDATION_ERROR');
  const invalidMime = createStoreImageAssociationValidator({ s3Adapter: {
    async headObject() { return { ContentType: 'image/svg+xml', ContentLength: 10 }; },
  } });
  await assert.rejects(invalidMime({ organizationId: ORG, storeId: STORE, imageKey: key }),
    e => e.code === 'VALIDATION_ERROR');
});

test('Store image Presigned URL checks the store and signs an owned key', async () => {
  const calls = [];
  const service = createFileService({
    idFactory: () => ID,
    storeRepository: { async getById(org, id) { return org === ORG && id === STORE ? store : null; } },
    s3Adapter: {
      async createPutUrl(args) { calls.push(args); return 'https://s3.example.test/put'; },
      async createGetUrl(args) { calls.push(args); return 'https://s3.example.test/get'; },
    },
  });
  const upload = await service.createStoreImageUploadUrl({
    organizationId: ORG, storeId: STORE, contentType: 'image/png',
  });
  assert.deepEqual(upload, { objectKey: key, url: 'https://s3.example.test/put', method: 'PUT', expiresInSeconds: 900 });
  assert.equal(await service.createStoredStoreImageUrl({ organizationId: ORG, storeId: STORE, imageKey: key }), 'https://s3.example.test/get');
  assert.equal(calls.length, 2);
  await assert.rejects(service.createStoreImageUploadUrl({
    organizationId: ORG, storeId: 'unknown', contentType: 'image/png',
  }), e => e.code === 'STORE_NOT_FOUND');
});

test('Management store update writes a verified imageKey and signs its URL', async () => {
  const updates = [];
  const service = createStoreService({
    repository: { async transactWrite(input) { updates.push(input); } },
    storeRepository: { async getById() { return store; } },
    validateStoreImageAssociation: async ({ imageKey }) => { assert.equal(imageKey, key); },
    createStoreImageUrl: async () => 'https://signed.example/cover',
    clock: () => '2026-10-26T00:30:00.000Z',
    idFactory: () => ID,
  });
  const updated = await service.updateStore({
    organizationId: ORG, storeId: STORE, actorId: 'user-1', changes: { imageKey: key },
  });
  assert.equal(updated.imageKey, key);
  assert.equal(updated.imageUrl, 'https://signed.example/cover');
  assert.match(updates[0].TransactItems[0].Update.UpdateExpression, /#imageKey = :imageKey/);
  assert.equal(updates[0].TransactItems[0].Update.ExpressionAttributeValues[':imageKey'], key);
});

test('Public Store DTO exposes only its signed URL, never the private imageKey', () => {
  const publicStore = toStorefrontStoreDto({ ...store, imageKey: key, imageUrl: 'https://signed.example/cover' });
  assert.equal(publicStore.imageUrl, 'https://signed.example/cover');
  assert.equal(Object.prototype.hasOwnProperty.call(publicStore, 'imageKey'), false);
});
