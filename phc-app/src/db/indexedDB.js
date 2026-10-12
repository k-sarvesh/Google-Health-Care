import { openDB } from 'idb';

const DB_NAME = 'PHCOfflineDB';
const DB_VERSION = 1;
export const STORE_NAME = 'inventory_sync_queue';

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create an object store with an auto-incrementing key
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const addSyncItem = async (payload) => {
  const db = await initDB();
  return db.add(STORE_NAME, {
    ...payload,
    offline_sync_id: crypto.randomUUID(), // useful for Member 4's backend tracking
    timestamp: new Date().toISOString(),
  });
};

export const getAllSyncItems = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const removeSyncItem = async (id) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};

export const updateSyncItem = async (item) => {
  const db = await initDB();
  return db.put(STORE_NAME, item);
};

export const clearSyncQueue = async () => {
  const db = await initDB();
  return db.clear(STORE_NAME);
};
