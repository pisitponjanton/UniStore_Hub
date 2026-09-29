'use strict';

const {
  sendList,
  sendSuccess,
} = require('../../utils/response');
const {
  validateNotificationListQuery,
} = require('../../validators/notification.validator');
const {
  createNotificationService,
} = require('./notification.service');

function createNotificationController(
  options = {},
) {
  const notificationService =
    options.notificationService ||
    createNotificationService(options);

  return {
    async list(req, res, next) {
      try {
        const filters =
          validateNotificationListQuery(
            req.query,
          );
        const result =
          await notificationService
            .listNotifications({
              userId: req.user.userId,
              ...filters,
            });

        return sendList(
          res,
          result.items,
          result.nextCursor,
        );
      } catch (error) {
        return next(error);
      }
    },

    async markRead(req, res, next) {
      try {
        return sendSuccess(
          res,
          await notificationService.markRead({
            userId: req.user.userId,
            notificationId:
              req.params.notificationId,
          }),
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createNotificationController,
};
