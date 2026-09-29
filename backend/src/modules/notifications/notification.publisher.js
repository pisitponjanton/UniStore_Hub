'use strict';

const {
  createSqsAdapter,
} = require('../../aws/sqs');
const { createId } = require('../../utils/id');
const {
  nowIsoUtc,
} = require('../../utils/time');
const {
  validateNotificationEvent,
} = require('./notification.event');

function createNotificationPublisher(
  options = {},
) {
  const idFactory =
    options.idFactory || createId;
  const clock = options.clock || nowIsoUtc;
  let sqsAdapter = options.sqsAdapter;

  function getSqsAdapter() {
    if (!sqsAdapter) {
      sqsAdapter = createSqsAdapter();
    }

    return sqsAdapter;
  }

  return {
    async publish({
      type,
      organizationId,
      recipientUserId,
      resourceType,
      resourceId,
      data = {},
      eventId = idFactory(),
      occurredAt = clock(),
    }) {
      const event = {
        version: 1,
        eventId,
        type,
        occurredAt,
        organizationId,
        recipientUserId,
        resourceType,
        resourceId,
        data,
      };

      validateNotificationEvent(event);
      await getSqsAdapter().sendJson(event);

      return event;
    },
  };
}

module.exports = {
  createNotificationPublisher,
};
