'use strict';

function toStoreDto(store) {
  if (!store) {
    return null;
  }

  return {
    storeId: store.storeId,
    organizationId: store.organizationId,
    name: store.name,
    description: store.description,
    imageKey: store.imageKey ?? null,
    imageUrl: store.imageUrl ?? null,
    status: store.status,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}

module.exports = {
  toStoreDto,
};
