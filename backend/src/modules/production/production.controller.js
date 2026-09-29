'use strict';

const { sendSuccess } = require('../../utils/response');
const {
  validateProductionQuery,
} = require('../../validators/production.validator');
const {
  createProductionService,
} = require('./production.service');

function createProductionController(options = {}) {
  const productionService =
    options.productionService ||
    createProductionService(options);

  return {
    async summary(req, res, next) {
      try {
        const { campaignId } =
          validateProductionQuery(req.query);

        const summary =
          await productionService.getSummary({
            organizationId:
              req.params.organizationId,
            campaignId,
          });

        return sendSuccess(res, summary);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createProductionController,
};
