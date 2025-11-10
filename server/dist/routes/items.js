"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Item_1 = __importDefault(require("../models/Item"));
const router = express_1.default.Router();
// Get all items
router.get('/', async (req, res) => {
    try {
        const items = await Item_1.default.find().sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
});
// Get items modified after a timestamp (for sync)
router.get('/sync', async (req, res) => {
    try {
        const lastSync = req.query.lastSync;
        const query = lastSync ? { updatedAt: { $gt: new Date(lastSync) } } : {};
        const items = await Item_1.default.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: items, timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Sync failed' });
    }
});
// Create item
router.post('/', async (req, res) => {
    try {
        const item = new Item_1.default(req.body);
        await item.save();
        res.status(201).json({ success: true, data: item });
    }
    catch (error) {
        res.status(400).json({ success: false, error: 'Failed to create item' });
    }
});
// Batch sync (upsert multiple items)
router.post('/sync', async (req, res) => {
    try {
        const { items } = req.body;
        const results = await Promise.all(items.map(async (item) => {
            return await Item_1.default.findOneAndUpdate({ id: item.id }, { ...item, syncedAt: new Date() }, { upsert: true, new: true });
        }));
        res.json({ success: true, data: results, synced: items.length });
    }
    catch (error) {
        res.status(400).json({ success: false, error: 'Batch sync failed' });
    }
});
// Update item
router.put('/:id', async (req, res) => {
    try {
        const item = await Item_1.default.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        res.json({ success: true, data: item });
    }
    catch (error) {
        res.status(400).json({ success: false, error: 'Failed to update item' });
    }
});
// Delete item
router.delete('/:id', async (req, res) => {
    try {
        const item = await Item_1.default.findOneAndDelete({ id: req.params.id });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        res.json({ success: true, message: 'Item deleted' });
    }
    catch (error) {
        res.status(400).json({ success: false, error: 'Failed to delete item' });
    }
});
exports.default = router;
