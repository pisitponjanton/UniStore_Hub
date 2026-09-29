'use strict';

const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');

const { config } = require('../config');
const { buildAwsClientOptions } = require('./client-options');

let defaultSqsClient;

function createSqsClient(options = {}) {
  return new SQSClient(buildAwsClientOptions(options));
}

function getSqsClient() {
  if (!defaultSqsClient) {
    defaultSqsClient = createSqsClient();
  }

  return defaultSqsClient;
}

function requireQueueUrl(queueUrl = config.notificationQueueUrl) {
  if (!queueUrl) {
    const error = new Error(
      'NOTIFICATION_QUEUE_URL is required for SQS operations',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return queueUrl;
}

function createSqsAdapter(options = {}) {
  const client = options.client || getSqsClient();
  const queueUrl = requireQueueUrl(options.queueUrl);

  return {
    async sendJson(message) {
      return client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(message),
        }),
      );
    },
  };
}

module.exports = {
  createSqsClient,
  getSqsClient,
  createSqsAdapter,
  requireQueueUrl,
};
