'use strict';

const { getEnv } = require('../src/config');
const {
  createPlatformAdminSeeder,
} = require('../src/modules/platform-admin/platform-admin.seed');

async function main() {
  const seeder =
    createPlatformAdminSeeder();
  const result = await seeder.seed({
    email: getEnv(
      'PLATFORM_ADMIN_EMAIL',
      { required: true },
    ),
    password: getEnv(
      'PLATFORM_ADMIN_PASSWORD',
      { required: true },
    ),
    name: getEnv(
      'PLATFORM_ADMIN_NAME',
      { required: true },
    ),
  });

  process.stdout.write(
    `${JSON.stringify({
      created: result.created,
      userId: result.user.userId,
      email: result.user.email,
      platformRole:
        result.user.platformRole,
    })}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `seed-platform-admin failed: ${error.code || error.name || 'ERROR'}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
