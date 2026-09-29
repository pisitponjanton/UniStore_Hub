'use strict';

const { sendList, sendSuccess } = require('../../utils/response');
const {
  validateCreateStoreBody,
  validateUpdateStoreBody,
} = require('../../validators/store.validator');
const { createStoreService } = require('./store.service');

function createStoreController(options = {}) {
  const storeService =
    options.storeService || createStoreService(options);

  return {
    async list(req, res, next) {
      try {
        const items = await storeService.listStores(
          req.params.organizationId,
        );

        return sendList(res, items, null);
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const input = validateCreateStoreBody(req.body);
        const store = await storeService.createStore({
          organizationId: req.params.organizationId,
          actorId: req.user.userId,
          ...input,
        });

        return sendSuccess(res, store, 201);
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        const store = await storeService.getStore({
          organizationId: req.params.organizationId,
          storeId: req.params.storeId,
        });

        return sendSuccess(res, store);
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const changes = validateUpdateStoreBody(req.body);
        const store = await storeService.updateStore({
          organizationId: req.params.organizationId,
          storeId: req.params.storeId,
          actorId: req.user.userId,
          changes,
        });

        return sendSuccess(res, store);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createStoreController,
};
