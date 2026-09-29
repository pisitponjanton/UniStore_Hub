'use strict';

function toNotificationDto(notification) {
  if (!notification) {
    return null;
  }

  return {
    notificationId: notification.notificationId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
  };
}

module.exports = {
  toNotificationDto,
};
