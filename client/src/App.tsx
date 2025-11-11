import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addItem, deleteItem } from './db/dexie';
import { useSyncManager } from './hooks/useSyncManager';
import {
  RefreshCw, Camera, Plus, Trash2, Download,
  CheckCircle, Inbox, Image, X, Sparkles, XCircle,
  WifiOff // Import new icon
} from 'lucide-react';
// Import PanInfo for the drag gesture
import { motion, AnimatePresence, cubicBezier, Transition, PanInfo } from 'framer-motion';

// --- ANIMATIONS (Unchanged) ---
const springTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};
const fastEase = cubicBezier(0.2, 0.8, 0.2, 1);
const fastTransition: Transition = { duration: 0.3, ease: fastEase };


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
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      setIsModalOpen(false);
      if (isOnline) {
        setTimeout(() => performSync(), 100);
      }
    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem(id);
      if (isOnline) {
        setTimeout(() => performSync(), 100);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // --- DRAG-TO-CLOSE HANDLER ---
  const handleDragEnd = (event: any, info: PanInfo) => {
    const dragThreshold = 200; // Dragged 200px down
    const velocityThreshold = 500; // Flicked down fast

    if (info.offset.y > dragThreshold || info.velocity.y > velocityThreshold) {
      setIsModalOpen(false);
    }
  };


  return (
    <div className={`min-h-screen bg-slate-100 ${isModalOpen ? 'overflow-hidden' : ''}`}>
      <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <Header
          isOnline={isOnline}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onSync={performSync}
          showInstallPrompt={showInstallPrompt}
          onInstall={handleInstallClick}
        />
        
        <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-5">
            <div className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <ItemList items={items} onDelete={handleDeleteItem} />
            </div>
          </div>
        </main>
      </div>

      {/* --- ADD ITEM MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.1 } }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            <motion.div
              // --- GESTURE & ANIMATION FIX ---
              drag="y" // 1. Enable vertical drag
              dragConstraints={{ top: 0, bottom: 0 }} // 2. Don't let it drag "up"
              dragElastic={{ bottom: 0.8 }} // 3. Allow it to be "pulled" down
              onDragEnd={handleDragEnd} // 4. Handle the "flick-to-close"
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: fastTransition }} // 5. Use FAST ease, not spring
              exit={{ y: "100%", transition: { duration: 0.2, ease: "easeOut" } }}
              className="fixed bottom-0 left-0 right-0 h-[90vh] bg-white rounded-t-3xl shadow-2xl z-50 cursor-grab active:cursor-grabbing"
            >
              <div className="max-w-4xl mx-auto p-5">
                {/* This handle is now the visual cue for dragging */}
                <div className="w-20 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />
                <AddItemForm 
                  onAddItem={handleAddItem} 
                  onClose={() => setIsModalOpen(false)} 
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- FLOATING ACTION BUTTON (FAB) --- */}
      <AnimatePresence>
        {!isModalOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { ...springTransition, delay: 0.3 } }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsModalOpen(true)}
            className="fixed z-40 bottom-6 right-6 w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-500/50 hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-8 h-8" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- HEADER REFACTORED FOR CLEANLINESS ---
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
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                PWA Notes
              </h1>
              {/* REMOVED SUBTITLE to de-clutter */}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {showInstallPrompt && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onInstall}
                // AESTHETIC CHANGE: Icon-only on mobile, text on sm+
                className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2 bg-success-500 text-white text-sm font-medium rounded-xl hover:bg-success-600 transition-all"
              >
                <Download className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline sm:ml-2">Install</span>
              </motion.button>
            )}
            
            {/* NEW COMPONENT: This single button replaces *both*
              the StatusIndicator and SyncButton.
            */}
            <SyncStatusButton
              isOnline={isOnline}
              isSyncing={isSyncing}
              onSync={onSync}
            />
          </div>
        </div>
      </div>
      {syncStatus !== 'idle' && (
        <div className="bg-primary-50 border-t border-primary-100">
          <p className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-xs text-center text-primary-700 font-medium">
            {syncStatus}
          </p>
        </div>
      )}
    </header>
  );
}

// --- NEW COMPONENT TO DE-CLUTTER HEADER ---
// This button shows Online/Offline status AND acts as the Sync button.
function SyncStatusButton({ isOnline, isSyncing, onSync }: { isOnline: boolean; isSyncing: boolean; onSync: () => void }) {
  
  const [buttonText, setButtonText] = useState('Online');
  const [Icon, setIcon] = useState(() => RefreshCw);

  useEffect(() => {
    if (!isOnline) {
      setButtonText('Offline');
      setIcon(() => WifiOff);
      return;
    }

    if (isSyncing) {
      setButtonText('Syncing...');
      setIcon(() => RefreshCw);
      return;
    }

    setButtonText('Online');
    setIcon(() => RefreshCw);

  }, [isOnline, isSyncing]);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onSync}
      disabled={!isOnline || isSyncing}
      // AESTHETIC CHANGE: Dynamic colors based on state
      className={`flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all
        ${!isOnline 
          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
          : isSyncing
          ? 'bg-primary-500 text-white cursor-not-allowed'
          : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
        }
      `}
    >
      <Icon className={`w-5 h-5 sm:w-4 sm:h-4 ${isSyncing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{buttonText}</span>
    </motion.button>
  );
}


// (No changes to AddItemForm, CameraView, ItemList, or ItemCard)
// ... (rest of the components from previous step) ...


interface AddItemFormProps {
  onAddItem: (item: Omit<Item, 'createdAt' | 'synced' | 'id'>) => void;
  onClose: () => void;
}

function AddItemForm({ onAddItem, onClose }: AddItemFormProps) {
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
    // Add "pointer-events-none" to the form container
    // so drag gestures on empty space pass through to the modal
    <div className="bg-white rounded-2xl p-5 space-y-4 pointer-events-none">
      {/* Add "pointer-events-auto" to all interactive elements */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-base font-medium placeholder-slate-400 transition-all pointer-events-auto"
        placeholder="✨ What's on your mind?"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white outline-none text-base placeholder-slate-400 transition-all resize-none pointer-events-auto"
        placeholder="Add more details..."
        rows={3}
      />

      {showCamera ? (
        <div className="pointer-events-auto">
          <CameraView
            onCapture={setCapturedImage}
            onClose={() => setShowCamera(false)}
          />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {capturedImage ? (
            <div className="flex items-center gap-3 px-4 py-2 bg-primary-100 rounded-xl pointer-events-auto">
              <Image className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">Image attached</span>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="p-1 text-danger-500 hover:bg-danger-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCamera(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors pointer-events-auto"
            >
              <Camera className="w-4 h-4" />
              <span className="text-sm">Take Photo</span>
            </motion.button>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto pointer-events-auto">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors text-sm"
            >
              <XCircle className="w-5 h-5" />
              <span>Cancel</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all text-sm"
            >
              <Plus className="w-5 h-5" />
              <span>Add Note</span>
            </motion.button>
          </div>
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
    const currentVideoElement = videoRef.current;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
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
    return () => {
      if (currentVideoElement && currentVideoElement.srcObject) {
        (currentVideoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
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
    <div className="space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-2xl bg-gray-900 shadow-2xl"
      />
      <div className="flex gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={capturePhoto}
          className="flex-1 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all"
        >
          Capture
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="px-5 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors"
        >
          Cancel
        </motion.button>
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
      <div className="text-center py-16 bg-white rounded-3xl shadow-md border border-slate-200">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading your notes...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1, transition: { ...fastTransition, delay: 0.2 } }}
        className="text-center py-20 bg-white rounded-3xl shadow-md border border-slate-200"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Inbox className="w-10 h-10 text-primary-400" />
        </motion.div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">No notes yet</h3>
        <p className="text-sm text-slate-500">Start capturing your thoughts! ✨</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {items.map((item, index) => (
          <ItemCard key={item.id} item={item} onDelete={onDelete} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ItemCard({ item, onDelete, index }: { item: Item; onDelete: (id: string) => void; index: number }) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: index * 0.05, ease: fastEase } }}
      exit={{ opacity: 0, x: -50, transition: { duration: 0.2, ease: fastEase } }}
      className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200"
    >
      <AnimatePresence mode="wait">
        {isDeleting ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: fastTransition }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
            className="p-5 flex flex-col items-center justify-center text-center"
          >
            <h4 className="text-base font-semibold text-danger-600 mb-2">
              Delete this note?
            </h4>
            <p className="text-sm text-slate-600 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDeleting(false)}
                className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors text-sm"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onDelete(item.id!)}
                className="flex items-center gap-2 px-6 py-2 bg-danger-600 text-white font-semibold rounded-xl hover:bg-danger-700 shadow-lg shadow-danger-500/30 transition-all text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={false}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
            className="relative"
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsDeleting(true)}
              className="absolute top-4 right-4 p-2 text-slate-400 rounded-xl hover:bg-danger-50 hover:text-danger-500 transition-all z-10"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>

            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-10">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium">
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
                {!item.synced ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold bg-warning-100 text-warning-700 px-3 py-1.5 rounded-full">
                    <div className="w-1.5 h-1.5 bg-warning-500 rounded-full animate-pulse"></div>
                    Pending sync
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-success-600 bg-success-50 px-3 py-1.5 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Synced</span>
                  </div>
                )}
              </div>
            </div>

            {item.imageUrl && (
              <div className="border-t border-slate-200 overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default App;