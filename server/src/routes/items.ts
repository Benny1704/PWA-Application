import express, { Request, Response } from 'express';
import Item from '../models/Item';

const router = express.Router();

// Get all items
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch items' });
  }
});

// Get items modified after a timestamp (for sync)
router.get('/sync', async (req: Request, res: Response) => {
  try {
    const lastSync = req.query.lastSync as string;
    const query = lastSync ? { updatedAt: { $gt: new Date(lastSync) } } : {};
    const items = await Item.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: items, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sync failed' });
  }
});

// Create item
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = new Item(req.body);
    await item.save();
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to create item' });
  }
});

// Batch sync (upsert multiple items)
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const results = await Promise.all(
      items.map(async (item: any) => {
        return await Item.findOneAndUpdate(
          { id: item.id },
          { ...item, syncedAt: new Date() },
          { upsert: true, new: true }
        );
      })
    );
    res.json({ success: true, data: results, synced: items.length });
  } catch (error) {
    // --- THIS IS THE NEW LINE ---
    console.error('❌ BATCH SYNC FAILED:', error); 
    // --- END NEW LINE ---
    res.status(400).json({ success: false, error: 'Batch sync failed' });
  }
});

// Update item
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const item = await Item.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await Item.findOneAndDelete({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to delete item' });
  }
});

export default router;