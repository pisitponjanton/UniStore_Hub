'use strict';

const {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} = require('@aws-sdk/client-sqs');

const { config } = require('../config');
const {
  buildAwsClientOptions,
} = require('./client-options');

let defaultSqsClient;

function createSqsClient(options = {}) {
  return new SQSClient(
    buildAwsClientOptions(options),
  );
}

function getSqsClient() {
  if (!defaultSqsClient) {
    defaultSqsClient = createSqsClient();
  }

  return defaultSqsClient;
}

function requireQueueUrl(
  queueUrl = config.notificationQueueUrl,
) {
  if (!queueUrl) {
    const error = new Error(
      'NOTIFICATION_QUEUE_URL is required for SQS operations',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return queueUrl;
}

function requireReceiptHandle(receiptHandle) {
  if (
    typeof receiptHandle !== 'string' ||
    receiptHandle.length === 0
  ) {
    const error = new Error(
      'SQS receipt handle is required to delete a message',
    );
    error.code = 'INVALID_SQS_MESSAGE';
    throw error;
  }

  return receiptHandle;
}

function createSqsAdapter(options = {}) {
  const client =
    options.client || getSqsClient();
  const queueUrl = requireQueueUrl(
    options.queueUrl,
  );

  return {
    async sendJson(message) {
      return client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody:
            JSON.stringify(message),
        }),
      );
    },

    async receiveMessages(
      receiveOptions = {},
    ) {
      const result = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages:
            receiveOptions.maxNumberOfMessages ??
            10,
          WaitTimeSeconds:
            receiveOptions.waitTimeSeconds ??
            20,
        }),
      );

      return Array.isArray(result.Messages)
        ? result.Messages
        : [];
    },

    async deleteMessage(receiptHandle) {
      return client.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle:
            requireReceiptHandle(
              receiptHandle,
            ),
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
  requireReceiptHandle,
};
