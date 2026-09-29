'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const { config } = require('../config');
const { buildAwsClientOptions } = require('./client-options');

let defaultDocumentClient;

function createDynamoDocumentClient(options = {}) {
  const baseClient =
    options.client ||
    new DynamoDBClient(buildAwsClientOptions(options));

  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

function getDynamoDocumentClient() {
  if (!defaultDocumentClient) {
    defaultDocumentClient = createDynamoDocumentClient();
  }

  return defaultDocumentClient;
}

function requireTableName(tableName = config.appTableName) {
  if (!tableName) {
    const error = new Error('APP_TABLE_NAME is required for DynamoDB operations');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return tableName;
}

function createDynamoRepository(options = {}) {
  const client = options.client || getDynamoDocumentClient();
  const tableName = requireTableName(options.tableName);

  return {
    async get(params) {
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          ...params,
        }),
      );

      return response.Item ?? null;
    },

    async put(params) {
      return client.send(
        new PutCommand({
          TableName: tableName,
          ...params,
        }),
      );
    },

    async update(params) {
      return client.send(
        new UpdateCommand({
          TableName: tableName,
          ...params,
        }),
      );
    },

    async delete(params) {
      return client.send(
        new DeleteCommand({
          TableName: tableName,
          ...params,
        }),
      );
    },

    async query(params) {
      const response = await client.send(
        new QueryCommand({
          TableName: tableName,
          ...params,
        }),
      );

      return {
        items: response.Items ?? [],
        lastEvaluatedKey: response.LastEvaluatedKey ?? null,
        count: response.Count ?? 0,
      };
    },

    async transactWrite(params) {
      return client.send(
        new TransactWriteCommand({
          ...params,
          TransactItems: params.TransactItems.map((item) => {
            const operation = Object.keys(item)[0];
            return {
              [operation]: {
                TableName: tableName,
                ...item[operation],
              },
            };
          }),
        }),
      );
    },
  };
}

module.exports = {
  createDynamoDocumentClient,
  getDynamoDocumentClient,
  createDynamoRepository,
  requireTableName,
};
