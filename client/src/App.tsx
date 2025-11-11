import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addItem, deleteItem } from './db/dexie';
import { useSyncManager } from './hooks/useSyncManager';
import { 
  RefreshCw, Camera, Plus, Trash2, Download, 
  CheckCircle, Inbox, Image, X, Sparkles 
} from 'lucide-react';

interface Item {
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
  synced: boolean;
  deleted?: boolean;
}

function App() {
  const { isSyncing, syncStatus, performSync, isOnline } = useSyncManager();
  
  // Fixed query - filter deleted items in JavaScript after sorting
  const items = useLiveQuery(() => 
    db.items
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then(allItems => allItems.filter(item => !item.deleted))
  ) as Item[] | undefined;

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    // const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleAddItem = async (newItem: Omit<Item, 'createdAt' | 'synced' | 'id'>) => {
    try {
      await addItem({
        title: newItem.title,
        description: newItem.description,
        imageUrl: newItem.imageUrl,
      });
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <Header
          isOnline={isOnline}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onSync={performSync}
          showInstallPrompt={showInstallPrompt}
          onInstall={handleInstallClick}
        />
        
        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className={`transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <AddItemForm onAddItem={handleAddItem} />
            </div>
            <div className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <ItemList items={items} onDelete={handleDeleteItem} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

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
    <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 transform hover:rotate-12 transition-transform duration-300">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                PWA Notes
              </h1>
              <p className="text-xs text-gray-500">Capture your thoughts</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <StatusIndicator isOnline={isOnline} />
            {showInstallPrompt && (
              <button
                onClick={onInstall}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-green-500/30 transform hover:scale-105 transition-all duration-300"
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
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-t border-purple-100">
          <p className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-sm text-center text-indigo-700 font-medium">
            {syncStatus}
          </p>
        </div>
      )}
    </header>
  );
}

function StatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className={`relative w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
        {isOnline && (
          <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
        )}
      </div>
      <span className="text-sm font-semibold text-gray-700">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

function SyncButton({ isOnline, isSyncing, onSync }: { isOnline: boolean; isSyncing: boolean; onSync: () => void }) {
  return (
    <button
      onClick={onSync}
      disabled={!isOnline || isSyncing}
      className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 disabled:hover:scale-100"
    >
      <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
    </button>
  );
}

interface AddItemFormProps {
  onAddItem: (item: Omit<Item, 'createdAt' | 'synced' | 'id'>) => void;
}

function AddItemForm({ onAddItem }: AddItemFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAddItem({ title, description, imageUrl: capturedImage || undefined });
    setTitle('');
    setDescription('');
    setCapturedImage(null);
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-xl rounded-3xl p-6 space-y-5 border border-purple-100 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none text-lg font-medium placeholder-gray-400 transition-all duration-300"
        placeholder="✨ What's on your mind?"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-transparent rounded-2xl focus:border-purple-500 focus:bg-white outline-none placeholder-gray-400 transition-all duration-300 resize-none"
        placeholder="Add more details..."
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
            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl">
              <Image className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">Image attached</span>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="p-1 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-medium rounded-xl hover:shadow-md transform hover:scale-105 transition-all duration-300"
            >
              <Camera className="w-4 h-4" />
              <span>Take Photo</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transform hover:scale-105 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            <span>Add Note</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface CameraViewProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

function CameraView({ onCapture, onClose }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 1. Capture the ref value in a variable
    const currentVideoElement = videoRef.current;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        // 2. Use the captured variable
        if (currentVideoElement) {
          currentVideoElement.srcObject = stream;
        }
      } catch (error) {
        console.error('Camera access denied:', error);
        alert('Camera access denied. Please enable camera permissions.');
        onClose();
      }
    };
    startCamera();

    // This is the cleanup function
    return () => {
      // 3. Use the *same captured variable* in the cleanup
      if (currentVideoElement && currentVideoElement.srcObject) {
        (currentVideoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [onClose]); // The dependency array is correct

  const capturePhoto = () => {
    // ... (rest of your component is fine)
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
    <div className="space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-2xl bg-gray-900 shadow-2xl"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={capturePhoto}
          className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transform hover:scale-105 transition-all duration-300"
        >
          Capture
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

interface ItemListProps {
  items: Item[] | undefined;
  onDelete: (id: string) => void;
}

function ItemList({ items, onDelete }: ItemListProps) {
  if (!items) {
    return (
      <div className="text-center py-16 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-purple-100">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading your notes...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-purple-100 transform transition-all duration-500 hover:scale-105">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <Inbox className="w-10 h-10 text-indigo-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">No notes yet</h3>
        <p className="text-gray-500">Start capturing your thoughts above! ✨</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item, index) => (
        <ItemCard key={item.id} item={item} onDelete={onDelete} index={index} />
      ))}
    </div>
  );
}

function ItemCard({ item, onDelete, index }: { item: Item; onDelete: (id: string) => void; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <article 
      className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden border border-purple-100 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 transform hover:-translate-y-1 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {item.title}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {item.description}
            </p>
          </div>
          <button
            onClick={() => onDelete(item.id!)}
            className={`p-2.5 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all duration-300 ${
              isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium">
            {new Date(item.createdAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {!item.synced ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-700 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
              Pending sync
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Synced</span>
            </div>
          )}
        </div>
      </div>

      {item.imageUrl && (
        <div className="border-t border-purple-100 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-auto object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      )}
    </article>
  );
}

export default App;