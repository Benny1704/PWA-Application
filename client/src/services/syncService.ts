import { db, getUnsyncedItems, markItemsAsSynced, getLastSyncTime, updateLastSyncTime } from '../db/dexie';
import { api } from './api';

export class SyncService {
  private isSyncing = false;

  async syncToServer(): Promise<{ success: boolean; synced: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, synced: 0, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      // Get all unsynced items from local DB
      const unsyncedItems = await getUnsyncedItems();
      
      if (unsyncedItems.length === 0) {
        console.log('No items to sync');
        return { success: true, synced: 0 };
      }

      console.log(`Syncing ${unsyncedItems.length} items to server...`);

      // Send items to server
      const response = await api.syncItems(unsyncedItems);

      if (response.success) {
        // Mark items as synced in local DB
        const ids = unsyncedItems.map(item => item.id!);
        await markItemsAsSynced(ids);
        await updateLastSyncTime();
        
        console.log(`✅ Successfully synced ${response.synced} items`);
        return { success: true, synced: response.synced || 0 };
      }

      return { success: false, synced: 0, error: response.error };
    } catch (error) {
      console.error('Sync failed:', error);
      return { 
        success: false, 
        synced: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.isSyncing = false;
    }
  }

  async syncFromServer(): Promise<{ success: boolean; downloaded: number; error?: string }> {
    try {
      const lastSync = await getLastSyncTime();
      const lastSyncStr = lastSync?.toISOString();

      console.log('Fetching updates from server...');
      const response = await api.getItemsForSync(lastSyncStr);

      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : [];
        
        // Update local DB with server data
        for (const item of items) {
          const existing = await db.items.get(item.id);
          
          if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
            await db.items.put({
              ...item,
              synced: true,
              createdAt: new Date(item.createdAt),
              updatedAt: new Date(item.updatedAt)
            });
          }
        }

        await updateLastSyncTime();
        console.log(`✅ Downloaded ${items.length} items from server`);
        return { success: true, downloaded: items.length };
      }

      return { success: false, downloaded: 0, error: response.error };
    } catch (error) {
      console.error('Download failed:', error);
      return { 
        success: false, 
        downloaded: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async fullSync(): Promise<{ success: boolean; synced: number; downloaded: number }> {
    console.log('🔄 Starting full sync...');
    
    // First, push local changes to server
    const uploadResult = await this.syncToServer();
    
    // Then, pull updates from server
    const downloadResult = await this.syncFromServer();

    return {
      success: uploadResult.success && downloadResult.success,
      synced: uploadResult.synced,
      downloaded: downloadResult.downloaded
    };
  }

  async registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore - Background Sync API
        await registration.sync.register('sync-items');
        console.log('Background sync registered');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }
}

export const syncService = new SyncService();