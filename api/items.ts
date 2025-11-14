import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

// Item Schema
const ItemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  userId: { type: String },
  syncedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Get or create model (important for serverless)
const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);

// Database connection caching
let isConnected = false;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectToDatabase();

    const { method, query, body } = req;
    const path = (query.path as string[]) || [];

    // GET /api/items - Get all items
    if (method === 'GET' && path.length === 0) {
      const items = await Item.find().sort({ createdAt: -1 });
      return res.json({ success: true, data: items });
    }

    // GET /api/items/sync - Sync endpoint
    if (method === 'GET' && path[0] === 'sync') {
      const lastSync = query.lastSync as string;
      const queryFilter = lastSync ? { updatedAt: { $gt: new Date(lastSync) } } : {};
      const items = await Item.find(queryFilter).sort({ createdAt: -1 });
      return res.json({ 
        success: true, 
        data: items, 
        timestamp: new Date().toISOString() 
      });
    }

    // POST /api/items - Create item
    if (method === 'POST' && path.length === 0) {
      const item = new Item(body);
      await item.save();
      return res.status(201).json({ success: true, data: item });
    }

    // POST /api/items/sync - Batch sync
    if (method === 'POST' && path[0] === 'sync') {
      const { items } = body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid request: items array required' 
        });
      }

      const results = await Promise.all(
        items.map(async (item: any) => {
          return await Item.findOneAndUpdate(
            { id: item.id },
            { ...item, syncedAt: new Date() },
            { upsert: true, new: true }
          );
        })
      );

      return res.json({ 
        success: true, 
        data: results, 
        synced: items.length 
      });
    }

    // PUT /api/items/:id - Update item
    if (method === 'PUT' && path.length === 1) {
      const itemId = path[0];
      const item = await Item.findOneAndUpdate(
        { id: itemId },
        body,
        { new: true }
      );

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      return res.json({ success: true, data: item });
    }

    // DELETE /api/items/:id - Delete item
    if (method === 'DELETE' && path.length === 1) {
      const itemId = path[0];
      const item = await Item.findOneAndDelete({ id: itemId });

      if (!item) {
        return res.status(404).json({ 
          success: false, 
          error: 'Item not found' 
        });
      }

      return res.json({ success: true, message: 'Item deleted' });
    }

    // Route not found
    return res.status(404).json({ 
      success: false, 
      error: 'Route not found' 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}