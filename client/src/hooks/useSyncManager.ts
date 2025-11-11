import { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { syncService } from '../services/syncService';
import { useOnlineStatus } from './useOnlineStatus';

export const useSyncManager = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const { isOnline, wasOffline } = useOnlineStatus();

  // --- START FIX ---

  // Use refs to hold the current state values.
  // This lets us use them inside useCallback without adding them to the dependency array.
  const isSyncingRef = useRef(isSyncing);
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const performSync = useCallback(async () => {
    // Check the *ref* values. This prevents stale state.
    if (!isOnlineRef.current || isSyncingRef.current) {
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Syncing...'); // Changed to 'Syncing...' for clarity

    try {
      const result = await syncService.fullSync();
      
      if (result.success) {
        setLastSyncTime(new Date());
        // Provide clearer success message
        if (result.synced > 0 || result.downloaded > 0) {
          setSyncStatus(
            `Sync complete: ${result.synced} uploaded, ${result.downloaded} downloaded`
          );
        } else {
          setSyncStatus('Already up to date');
        }
      } else {
        setSyncStatus('Sync failed. Will retry.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('Sync error. Will retry.');
    } finally {
      setIsSyncing(false);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }
  }, []); // <-- EMPTY DEPENDENCY ARRAY. This function is now stable.

  // --- END FIX ---


  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && wasOffline) {
      console.log('Connection restored, auto-syncing...');
      performSync();
    }
  }, [isOnline, wasOffline, performSync]); // This is safe now

  // Register background sync
  useEffect(() => {
    syncService.registerBackgroundSync();

    // This handler now calls the stable performSync
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'BACKGROUND_SYNC') {
        console.log('Background sync message received');
        performSync();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handler);
    }

    // Add cleanup function to remove the listener
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handler);
      }
    };
  }, [performSync]); // This is safe now, as it runs only once

  return {
    isSyncing,
    lastSyncTime,
    syncStatus,
    performSync,
    isOnline
  };
};