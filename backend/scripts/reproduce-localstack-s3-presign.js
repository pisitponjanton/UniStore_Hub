'use strict';

const { createS3Adapter, createS3Client } = require('../src/aws/s3');

const OBJECT_KEY =
  'payments/55555555-5555-4555-8555-555555555555/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function main() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const bucketName = process.env.FILES_BUCKET_NAME;

  if (!endpoint || !bucketName) {
    throw new Error(
      'AWS_ENDPOINT_URL and FILES_BUCKET_NAME are required',
    );
  }

  const client = createS3Client({
    endpoint,
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  });

  const adapter = createS3Adapter({
    client,
    bucketName,
  });

  const url = await adapter.createPutUrl({
    objectKey: OBJECT_KEY,
    contentType: 'image/png',
    expiresInSeconds: 900,
  });

  const parsed = new URL(url);
  const queryKeys = [
    ...parsed.searchParams.keys(),
  ].sort();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
    },
    body: Buffer.from(
      'browser-equivalent-localstack-presign-repro',
    ),
  });

  const responseText = await response.text();
  const code =
    responseText.match(/<Code>([^<]+)<\/Code>/)?.[1] ||
    null;
  const message =
    responseText.match(
      /<Message>([^<]+)<\/Message>/,
    )?.[1] || null;

  process.stdout.write(
    `${JSON.stringify(
      {
        status: response.status,
        ok: response.ok,
        queryKeys,
        hasChecksumAlgorithm:
          parsed.searchParams.has(
            'x-amz-sdk-checksum-algorithm',
          ),
        hasChecksumCrc32:
          parsed.searchParams.has(
            'x-amz-checksum-crc32',
          ),
        errorCode: code,
        errorMessage: message,
      },
      null,
      2,
    )}\n`,
  );

  process.exitCode =
    response.ok ? 0 : 2;
}

main().catch((error) => {
  process.stderr.write(
    `reproduction failed: ${error.code || error.name || 'ERROR'}: ${error.message}\n`,
  );
  process.exitCode = 1;
});
