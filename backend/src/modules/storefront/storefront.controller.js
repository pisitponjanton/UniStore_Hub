'use strict';

const {
  sendList,
  sendSuccess,
} = require('../../utils/response');
const {
  createStorefrontService,
} = require('./storefront.service');

function createStorefrontController(options = {}) {
  const service =
    options.storefrontService ||
    createStorefrontService(options);

  return {
    async listOrganizations(req, res, next) {
      try {
        return sendList(
          res,
          await service.listOrganizations(),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async listStores(req, res, next) {
      try {
        return sendList(
          res,
          await service.listStores(
            req.params.organizationId,
          ),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async getStore(req, res, next) {
      try {
        return sendSuccess(
          res,
          await service.getStore(
            req.params.organizationId,
            req.params.storeId,
          ),
        );
      } catch (error) {
        return next(error);
      }
    },

    async listProducts(req, res, next) {
      try {
        return sendList(
          res,
          await service.listProducts(
            req.params.organizationId,
            req.params.storeId,
          ),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async getProduct(req, res, next) {
      try {
        return sendSuccess(
          res,
          await service.getProduct(
            req.params.organizationId,
            req.params.storeId,
            req.params.productId,
          ),
        );
      } catch (error) {
        return next(error);
      }
    },

    async listCampaigns(req, res, next) {
      try {
        return sendList(
          res,
          await service.listCampaigns(
            req.params.organizationId,
            req.params.storeId,
          ),
          null,
        );
      } catch (error) {
        return next(error);
      }
    },

    async getCampaign(req, res, next) {
      try {
        return sendSuccess(
          res,
          await service.getCampaign(
            req.params.organizationId,
            req.params.storeId,
            req.params.campaignId,
          ),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createStorefrontController,
};
