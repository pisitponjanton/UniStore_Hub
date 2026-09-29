'use strict';

const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { config } = require('../config');
const { buildAwsClientOptions } = require('./client-options');

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 900;

let defaultS3Client;

function createS3Client(options = {}) {
  const endpoint = options.endpoint ?? config.awsEndpointUrl;

  return new S3Client({
    ...buildAwsClientOptions(options),
    ...(endpoint ? { forcePathStyle: true } : {}),
  });
}

function getS3Client() {
  if (!defaultS3Client) {
    defaultS3Client = createS3Client();
  }

  return defaultS3Client;
}

function requireBucketName(bucketName = config.filesBucketName) {
  if (!bucketName) {
    const error = new Error('FILES_BUCKET_NAME is required for S3 operations');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  return bucketName;
}

function createS3Adapter(options = {}) {
  const client = options.client || getS3Client();
  const bucketName = requireBucketName(options.bucketName);

  return {
    async createPutUrl({
      objectKey,
      contentType,
      expiresInSeconds = DEFAULT_PRESIGN_EXPIRES_SECONDS,
    }) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: contentType,
      });

      return getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
    },

    async createGetUrl({
      objectKey,
      expiresInSeconds = DEFAULT_PRESIGN_EXPIRES_SECONDS,
    }) {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      });

      return getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
    },

    async headObject({ objectKey }) {
      return client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        }),
      );
    },
  };
}

module.exports = {
  DEFAULT_PRESIGN_EXPIRES_SECONDS,
  createS3Client,
  getS3Client,
  createS3Adapter,
  requireBucketName,
};
