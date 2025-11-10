import { useState, useEffect, useCallback } from 'react';
import { syncService } from '../services/syncService';
import { useOnlineStatus } from './useOnlineStatus';

export const useSyncManager = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const { isOnline, wasOffline } = useOnlineStatus();

  const performSync = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      const result = await syncService.fullSync();
      
      if (result.success) {
        setLastSyncTime(new Date());
        setSyncStatus(
          `Synced: ${result.synced} uploaded, ${result.downloaded} downloaded`
        );
      } else {
        setSyncStatus('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('Sync error');
    } finally {
      setIsSyncing(false);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  }, [isOnline, isSyncing]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && wasOffline) {
      console.log('Connection restored, auto-syncing...');
      performSync();
    }
  }, [isOnline, wasOffline, performSync]);

  // Register background sync
  useEffect(() => {
    syncService.registerBackgroundSync();

    // Listen for background sync messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'BACKGROUND_SYNC') {
          console.log('Background sync message received');
          performSync();
        }
      });
    }
  }, [performSync]);

  return {
    isSyncing,
    lastSyncTime,
    syncStatus,
    performSync,
    isOnline
  };
};