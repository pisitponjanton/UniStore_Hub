'use strict';

const {
  NOTIFICATION_TYPE,
  NOTIFICATION_LABEL,
} = require('./notification.constants');
const {
  createNotificationController,
} = require('./notification.controller');
const {
  UUID_V4_PATTERN,
  FORBIDDEN_EVENT_DATA_KEYS,
  invalidEvent,
  assertSafeEventData,
  validateNotificationEvent,
  mapEventToNotification,
} = require('./notification.event');
const {
  toNotificationDto,
} = require('./notification.mapper');
const {
  createNotificationPublisher,
} = require('./notification.publisher');
const {
  createNotificationRepository,
} = require('./notification.repository');
const {
  createNotificationRouter,
} = require('./notification.routes');
const {
  notificationNotFound,
  createNotificationService,
} = require('./notification.service');

module.exports = {
  NOTIFICATION_TYPE,
  NOTIFICATION_LABEL,
  createNotificationController,
  UUID_V4_PATTERN,
  FORBIDDEN_EVENT_DATA_KEYS,
  invalidEvent,
  assertSafeEventData,
  validateNotificationEvent,
  mapEventToNotification,
  toNotificationDto,
  createNotificationPublisher,
  createNotificationRepository,
  createNotificationRouter,
  notificationNotFound,
  createNotificationService,
};
