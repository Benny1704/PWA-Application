// client/src/App.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addItem, deleteItem } from './db/dexie';
import { useSyncManager } from './hooks/useSyncManager';
import { 
  Wifi, WifiOff, RefreshCw, Camera, Plus, Trash2, Download, 
  CheckCircle, Inbox, Image as ImageIcon, X 
} from 'lucide-react';

// --- Item Interface ---
interface Item {
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
  synced: boolean;
  deleted?: number; // Added for dexie query
}

// --- Main App Component ---
function App() {
  const { isSyncing, syncStatus, performSync, isOnline } = useSyncManager();

  // Fetch items that are not marked as deleted
  const items = useLiveQuery(() => 
    db.items.where('deleted').notEqual(1).reverse().sortBy('createdAt')
  ) as Item[] | undefined;

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Install prompt handler
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleAddItem = async (newItem: Omit<Item, 'createdAt' | 'synced' | 'id'>) => {
    try {
      // --- START FIX ---
      // The `newItem` object here carries the type from our local `Item`
      // interface, which has `deleted?: number` (to match the Dexie query).
      // The imported `addItem` function, however, expects `deleted?: boolean`.
      //
      // To fix this, we create a new, "clean" object with only the
      // properties `addItem` *actually* needs for a new item. This
      // breaks the type conflict.
      const itemToAdd = {
        title: newItem.title,
        description: newItem.description,
        imageUrl: newItem.imageUrl,
      };

      await addItem(itemToAdd);
      // --- END FIX ---

      // Trigger sync if online
      if (isOnline) {
        setTimeout(() => performSync(), 100);
      }
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(id);
        if (isOnline) {
          setTimeout(() => performSync(), 100);
        }
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        isOnline={isOnline}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onSync={performSync}
        showInstallPrompt={showInstallPrompt}
        onInstall={handleInstallClick}
      />
      
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AddItemForm onAddItem={handleAddItem} />
          <ItemList items={items} onDelete={handleDeleteItem} />
        </div>
      </main>
    </div>
  );
}

// --- Header Component ---
interface HeaderProps {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: string;
  onSync: () => void;
  showInstallPrompt: boolean;
  onInstall: () => void;
}

function Header({ isOnline, isSyncing, syncStatus, onSync, showInstallPrompt, onInstall }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <h1 className="text-xl font-semibold text-gray-900">PWA Notes</h1>
          <div className="flex items-center gap-4">
            <StatusIndicator isOnline={isOnline} />
            {showInstallPrompt && (
              <button
                onClick={onInstall}
                title="Install App"
                className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}
            <SyncButton isOnline={isOnline} isSyncing={isSyncing} onSync={onSync} />
          </div>
        </div>
      </div>
      {syncStatus !== 'idle' && (
        <div className="bg-gray-50 border-t border-gray-200">
          <p className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-sm text-center text-gray-600">
            {syncStatus}
          </p>
        </div>
      )}
    </header>
  );
}

// --- Status Indicator Component ---
function StatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm font-medium text-gray-600">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

// --- Sync Button Component ---
function SyncButton({ isOnline, isSyncing, onSync }: { isOnline: boolean; isSyncing: boolean; onSync: () => void }) {
  return (
    <button
      onClick={onSync}
      disabled={!isOnline || isSyncing}
      title="Sync Items"
      className="flex items-center justify-center w-10 h-10 text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
    </button>
  );
}

// --- Add Item Form Component ---
interface AddItemFormProps {
  onAddItem: (item: Omit<Item, 'createdAt' | 'synced' | 'id'>) => void;
}

function AddItemForm({ onAddItem }: AddItemFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddItem({ title, description, imageUrl: capturedImage || undefined });
    setTitle('');
    setDescription('');
    setCapturedImage(null);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-5 space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        placeholder="Enter title"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        placeholder="Enter description..."
        rows={3}
      />

      {showCamera ? (
        <CameraView
          onCapture={setCapturedImage}
          onClose={() => setShowCamera(false)}
        />
      ) : (
        <div className="flex justify-between items-center">
          {capturedImage ? (
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              <span className="text-sm text-gray-700">Image attached</span>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="p-1 text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Take Photo</span>
            </button>
          )}

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </button>
        </div>
      )}
    </form>
  );
}

// --- Camera View Component ---
interface CameraViewProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

function CameraView({ onCapture, onClose }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Camera access denied:', error);
        alert('Camera access denied. Please enable camera permissions.');
        onClose();
      }
    };
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        onCapture(canvasRef.current.toDataURL('image/jpeg'));
        onClose();
      }
    }
  };

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg bg-gray-900"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={capturePhoto}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Capture
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// --- Item List Component ---
interface ItemListProps {
  items: Item[] | undefined;
  onDelete: (id: string) => void;
}

function ItemList({ items, onDelete }: ItemListProps) {
  if (!items) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-md">
        <p className="text-gray-500">Loading items...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-md">
        <Inbox className="w-12 h-12 text-gray-400 mx-auto" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">No items yet</h3>
        <p className="mt-1 text-sm text-gray-500">Add your first item above!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
}

// --- Item Card Component ---
function ItemCard({ item, onDelete }: { item: Item; onDelete: (id: string) => void }) {
  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden transition-shadow hover:shadow-lg">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {item.title}
            </h3>
            <p className="text-sm text-gray-600 mt-1 mb-2">
              {item.description}
            </p>
          </div>
          <button
            onClick={() => onDelete(item.id!)}
            title="Delete Item"
            className="p-2 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {new Date(item.createdAt).toLocaleString()}
          </span>
          {!item.synced ? (
            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
              Pending sync
            </span>
          ) : (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Synced</span>
            </div>
          )}
        </div>
      </div>

      {item.imageUrl && (
        <div className="border-t border-gray-200">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
    </article>
  );
}

export default App;