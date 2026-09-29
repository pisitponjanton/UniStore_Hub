'use strict';

const { app } = require('./app');
const { config } = require('./config');
const { logger } = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info('backend_local_server_started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
  });
});

function shutdown(signal) {
  logger.info('backend_local_server_stopping', { signal });

  server.close((error) => {
    if (error) {
      logger.error('backend_local_server_stop_failed', {
        signal,
        errorCode: error.code,
      });
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
