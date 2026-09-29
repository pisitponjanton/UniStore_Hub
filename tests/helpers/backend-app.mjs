import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

export function loadBackendApp(options) {
  const modulePath = new URL('../../backend/src/app.js', import.meta.url);
  const backend = requireFromHere(modulePath.pathname);

  if (options !== undefined) {
    if (typeof backend?.createApp !== 'function') {
      throw new TypeError('backend/src/app.js must export createApp(options)');
    }

    const configuredApp = backend.createApp(options);
    if (!configuredApp || typeof configuredApp.listen !== 'function') {
      throw new TypeError('backend createApp(options) must return an Express app');
    }

    return configuredApp;
  }

  if (!backend?.app || typeof backend.app.listen !== 'function') {
    throw new TypeError('backend/src/app.js must export an Express app');
  }

  return backend.app;
}

export async function withBackendServer(run, options) {
  const app = loadBackendApp(options);
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run({ app, server, baseUrl });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
