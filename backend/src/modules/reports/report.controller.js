'use strict';

const {
  sendSuccess,
} = require('../../utils/response');
const {
  validateReportQuery,
} = require('../../validators/report.validator');
const {
  createReportService,
} = require('./report.service');

function createReportController(options = {}) {
  const reportService =
    options.reportService ||
    createReportService(options);

  return {
    async summary(req, res, next) {
      try {
        const filters =
          validateReportQuery(req.query);

        return sendSuccess(
          res,
          await reportService.getSummary({
            organizationId:
              req.params.organizationId,
            ...filters,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createReportController,
};
