'use strict';

const { config } = require('./config');
const {
  createSqsAdapter,
} = require('./aws/sqs');
const {
  createNotificationWorker,
} = require('./worker');
const { logger } = require('./utils/logger');

const LOCALSTACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'localstack',
]);

function assertLocalWorkerConfig(
  workerConfig = config,
) {
  if (workerConfig.nodeEnv === 'production') {
    const error = new Error(
      'Local Worker cannot run with NODE_ENV=production',
    );
    error.code = 'LOCAL_WORKER_FORBIDDEN';
    throw error;
  }

  if (!workerConfig.awsEndpointUrl) {
    const error = new Error(
      'AWS_ENDPOINT_URL is required for the Local Worker',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  let endpoint;

  try {
    endpoint = new URL(
      workerConfig.awsEndpointUrl,
    );
  } catch {
    const error = new Error(
      'AWS_ENDPOINT_URL must be a valid LocalStack URL',
    );
    error.code = 'CONFIG_INVALID';
    throw error;
  }

  if (
    !LOCALSTACK_HOSTS.has(
      endpoint.hostname,
    )
  ) {
    const error = new Error(
      'Local Worker requires a localhost or LocalStack AWS endpoint',
    );
    error.code = 'LOCAL_WORKER_FORBIDDEN';
    throw error;
  }

  if (!workerConfig.notificationQueueUrl) {
    const error = new Error(
      'NOTIFICATION_QUEUE_URL is required for the Local Worker',
    );
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return workerConfig;
}

function toWorkerRecord(message) {
  return {
    messageId: message?.MessageId,
    body: message?.Body,
  };
}

function createLocalNotificationWorker(
  options = {},
) {
  const log = options.logger || logger;
  const worker =
    options.worker ||
    createNotificationWorker(
      options.workerOptions,
    );
  const sqsAdapter =
    options.sqsAdapter ||
    createSqsAdapter(
      options.sqsOptions,
    );
  let stopped = false;

  async function pollOnce() {
    const messages =
      await sqsAdapter.receiveMessages({
        maxNumberOfMessages: 10,
        waitTimeSeconds: 20,
      });

    if (messages.length === 0) {
      return {
        received: 0,
        failed: 0,
        deleted: 0,
      };
    }

    const result = await worker.handleBatch({
      Records: messages.map(
        toWorkerRecord,
      ),
    });
    const failedIds = new Set(
      result.batchItemFailures.map(
        (failure) =>
          failure.itemIdentifier,
      ),
    );
    let deleted = 0;

    for (const message of messages) {
      if (
        failedIds.has(message.MessageId)
      ) {
        continue;
      }

      await sqsAdapter.deleteMessage(
        message.ReceiptHandle,
      );
      deleted += 1;
    }

    const summary = {
      received: messages.length,
      failed: failedIds.size,
      deleted,
    };

    log.info(
      'local_notification_worker_batch_completed',
      summary,
    );

    return summary;
  }

  async function run() {
    stopped = false;

    while (!stopped) {
      await pollOnce();
    }
  }

  function stop() {
    stopped = true;
  }

  return {
    pollOnce,
    run,
    stop,
  };
}

async function main() {
  assertLocalWorkerConfig();

  const runtime =
    createLocalNotificationWorker();

  const stop = () => {
    logger.info(
      'local_notification_worker_stopping',
    );
    runtime.stop();
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  logger.info(
    'local_notification_worker_started',
  );

  await runtime.run();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(
      'local_notification_worker_failed',
      {
        errorCode:
          error?.code ||
          error?.name ||
          'UNKNOWN',
      },
    );
    process.exitCode = 1;
  });
}

module.exports = {
  LOCALSTACK_HOSTS,
  assertLocalWorkerConfig,
  toWorkerRecord,
  createLocalNotificationWorker,
  main,
};
