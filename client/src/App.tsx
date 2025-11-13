import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addItem, deleteItem } from './db/dexie';
import { useSyncManager } from './hooks/useSyncManager';
import {
  RefreshCw, Camera, Plus, Trash2, Download,
  CheckCircle, Inbox, Image, X, Sparkles,
  WifiOff, Zap
} from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

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
    setTimeout(() => setMounted(true), 50);
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

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${isModalOpen ? 'overflow-hidden' : ''}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        <Header
          isOnline={isOnline}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onSync={performSync}
          showInstallPrompt={showInstallPrompt}
          onInstall={handleInstallClick}
        />
        
        <main className="max-w-5xl mx-auto px-3 py-4 sm:px-6 lg:px-8 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <ItemList items={items} onDelete={handleDeleteItem} />
          </motion.div>
        </main>
      </motion.div>

      {/* Modal with proper dragging */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            
            <ModalSheet onClose={() => setIsModalOpen(false)}>
              <AddItemForm 
                onAddItem={handleAddItem} 
                onClose={() => setIsModalOpen(false)} 
              />
            </ModalSheet>
          </>
        )}
      </AnimatePresence>

      {/* FAB - Mobile optimized */}
      <AnimatePresence>
        {!isModalOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsModalOpen(true)}
            className="fixed z-40 bottom-6 right-4 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50 active:shadow-indigo-600/60 transition-shadow"
          >
            <Plus className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Modal Sheet Component with proper drag handling
function ModalSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [dragY, setDragY] = useState(0);
  
  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: dragY }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.8 }}
      onDrag={(_event, info) => {
        if (info.offset.y > 0) {
          setDragY(info.offset.y);
        }
      }}
      onDragEnd={handleDragEnd}
      className="fixed bottom-0 left-0 right-0 max-h-[92vh] bg-white rounded-t-[2rem] shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      {/* Drag Handle */}
      <div className="py-3 px-4 flex-shrink-0 bg-gradient-to-b from-slate-50 to-white cursor-grab active:cursor-grabbing">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 overscroll-contain">
        {children}
      </div>
    </motion.div>
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
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-200/50 sticky top-0 z-30"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <motion.div 
            className="flex items-center gap-2 sm:gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
            </motion.div>
            <div>
              <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                PWA Notes
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500">Sync everywhere</p>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-2">
            {showInstallPrompt && (
              <motion.button
                initial={{ scale: 0, x: 20 }}
                animate={{ scale: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-shadow"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Install</span>
              </motion.button>
            )}
            
            <SyncStatusButton
              isOnline={isOnline}
              isSyncing={isSyncing}
              onSync={onSync}
            />
          </div>
        </div>
      </div>
      <AnimatePresence>
        {syncStatus !== 'idle' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100 overflow-hidden"
          >
            <p className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2 text-[10px] sm:text-xs text-center text-indigo-700 font-medium">
              <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
              {syncStatus}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function SyncStatusButton({ isOnline, isSyncing, onSync }: { isOnline: boolean; isSyncing: boolean; onSync: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: isOnline && !isSyncing ? 0.95 : 1 }}
      onClick={onSync}
      disabled={!isOnline || isSyncing}
      className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all
        ${!isOnline 
          ? 'bg-slate-100 text-slate-400'
          : isSyncing
          ? 'bg-indigo-100 text-indigo-600'
          : 'bg-indigo-50 text-indigo-600 active:bg-indigo-100'
        }
      `}
    >
      {!isOnline ? (
        <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      ) : (
        <motion.div
          animate={{ rotate: isSyncing ? 360 : 0 }}
          transition={{ duration: 1, repeat: isSyncing ? Infinity : 0, ease: "linear" }}
        >
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </motion.div>
      )}
      <span className="hidden sm:inline">
        {!isOnline ? 'Offline' : isSyncing ? 'Syncing...' : 'Online'}
      </span>
    </motion.button>
  );
}

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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-4 py-4"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">Create New Note</h2>
      
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none text-sm sm:text-base font-semibold placeholder-slate-400 transition-all"
        placeholder="✨ What's on your mind?"
        autoFocus
      />
      
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none text-sm sm:text-base placeholder-slate-400 transition-all resize-none"
        placeholder="Add more details..."
        rows={4}
      />

      {showCamera ? (
        <CameraView
          onCapture={setCapturedImage}
          onClose={() => setShowCamera(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {capturedImage && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200"
            >
              <Image className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <span className="text-xs sm:text-sm font-semibold text-indigo-700 flex-1">Image attached</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setCapturedImage(null)}
                className="p-1.5 text-indigo-600 active:bg-indigo-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {!capturedImage && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCamera(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl active:bg-slate-200 transition-colors"
              >
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Take Photo</span>
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl active:bg-slate-200 transition-colors"
            >
              Cancel
            </motion.button>

            <motion.button
              whileTap={{ scale: title.trim() ? 0.98 : 1 }}
              onClick={handleSubmit}
              disabled={!title.trim()}
              className={`flex-1 px-4 py-2.5 sm:px-6 sm:py-3 text-sm font-bold rounded-xl transition-all shadow-lg
                ${title.trim()
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white active:shadow-xl active:shadow-indigo-500/30'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              Add Note
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-xl sm:rounded-2xl bg-gray-900 shadow-2xl"
      />
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={capturePhoto}
          className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 active:shadow-xl transition-all"
        >
          Capture
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="px-5 py-3 bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl active:bg-slate-300 transition-colors"
        >
          Cancel
        </motion.button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}

interface ItemListProps {
  items: Item[] | undefined;
  onDelete: (id: string) => void;
}

function ItemList({ items, onDelete }: ItemListProps) {
  if (!items) {
    return (
      <div className="text-center py-16 sm:py-20 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-100 rounded-full mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Loading your notes...</p>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center py-20 sm:py-24 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200"
      >
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-lg"
        >
          <Inbox className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-400" />
        </motion.div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">No notes yet</h3>
        <p className="text-sm sm:text-base text-slate-500">Start capturing your thoughts! ✨</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
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
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.95 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200, damping: 25 }}
      className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden active:border-indigo-200 transition-all"
    >
      <AnimatePresence mode="wait">
        {isDeleting ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-5 sm:p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-red-50 to-rose-50"
          >
            <h4 className="text-base sm:text-lg font-bold text-rose-700 mb-2">
              Delete this note?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">This can't be undone</p>
            <div className="flex gap-3 w-full">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDeleting(false)}
                className="flex-1 px-4 py-2 sm:px-5 sm:py-2 bg-white text-slate-700 text-sm font-semibold rounded-lg sm:rounded-xl active:bg-slate-100 transition-colors border border-slate-200"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onDelete(item.id!)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2 bg-gradient-to-r from-rose-600 to-red-600 text-white text-sm font-bold rounded-lg sm:rounded-xl shadow-lg shadow-rose-500/30 active:shadow-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="content" className="relative">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsDeleting(true)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 sm:p-2.5 text-slate-400 rounded-lg sm:rounded-xl active:bg-rose-50 active:text-rose-500 transition-all z-10"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>

            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <h3 className="text-base sm:text-xl font-bold text-slate-900 pr-10 leading-tight">
                  {item.title}
                </h3>
              </div>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>

              <div className="flex items-center justify-between mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </span>
                {!item.synced ? (
                  <motion.span 
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-amber-200"
                  >
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full" />
                    Pending
                  </motion.span>
                ) : (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-600 bg-gradient-to-r from-emerald-50 to-green-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-emerald-200"
                  >
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Synced
                  </motion.div>
                )}
              </div>
            </div>

            {item.imageUrl && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-t border-slate-200"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-auto"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default App;