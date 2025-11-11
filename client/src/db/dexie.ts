// client/src/db/dexie.ts

import Dexie, { Table } from 'dexie';

export interface Item {
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  deleted?: boolean;
}

export interface SyncMetadata {
  id?: number;
  lastSyncTime: Date;
  pendingChanges: number;
}

export class PWADatabase extends Dexie {
  items!: Table<Item, string>;
  syncMetadata!: Table<SyncMetadata, number>;

  constructor() {
    super('PWADatabase');
    
    // Original schema
    this.version(1).stores({
      items: 'id, createdAt, updatedAt, synced, deleted',
      syncMetadata: '++id, lastSyncTime'
    });

    // Version 2: Added compound index for sorting
    this.version(2).stores({
      items: 'id, createdAt, updatedAt, synced, deleted, [deleted+createdAt]', // <-- This is the upgrade
      // syncMetadata schema is unchanged and carries over
    });
  }
}

export const db = new PWADatabase();

// --- HELPER FUNCTIONS ---

export const addItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'synced'>) => {
  const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  
  const newItem: Item = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
    synced: false,
    deleted: false // <-- This is the critical fix
  };
  
  await db.items.add(newItem);
  return newItem;
};

export const updateItem = async (id: string, updates: Partial<Item>) => {
  await db.items.update(id, {
    ...updates,
    updatedAt: new Date(),
    synced: false
  });
};

export const deleteItem = async (id: string) => {
  await db.items.update(id, {
    deleted: true,
    synced: false,
    updatedAt: new Date()
  });
};

export const getUnsyncedItems = async () => {
  // --- THIS IS THE FIX ---
  // Use filter() to check for the boolean 'false'.
  // This is the correct way to query for non-indexable booleans.
  return await db.items.filter(item => item.synced === false).toArray();
};

export const markItemsAsSynced = async (ids: string[]) => {
  await db.items.bulkUpdate(
    ids.map(id => ({
      key: id,
      changes: { synced: true, updatedAt: new Date() }
    }))
  );
};

export const getLastSyncTime = async (): Promise<Date | null> => {
  const metadata = await db.syncMetadata.toArray();
  return metadata.length > 0 ? metadata[0].lastSyncTime : null;
};

export const updateLastSyncTime = async () => {
  const metadata = await db.syncMetadata.toArray();
  if (metadata.length > 0) {
    await db.syncMetadata.update(metadata[0].id!, { lastSyncTime: new Date() });
  } else {
    await db.syncMetadata.add({ lastSyncTime: new Date(), pendingChanges: 0 });
  }
};