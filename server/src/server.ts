// server/src/server.ts

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import itemRoutes from './routes/items';

dotenv.config();

const app = express();

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set.');
}

// Only attempt to connect if the URI is present
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB');
    })
    .catch((error) => {
      console.error('❌ MongoDB connection error:', error);
    });
}

// --- Middleware ---
// You might want to restrict this in production:
// app.use(cors({ origin: 'https://your-app-name.vercel.app' }));
app.use(cors()); 

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Routes ---
// Your vercel.json rewrites /api/* to this function,
// so your app needs to handle routes starting with /api.
app.use('/api/items', itemRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start Server for Local Development ---
// This block will start the server locally
// Vercel sets a 'VERCEL' env variable, so this block will be ignored on deployment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server listening locally on http://localhost:${PORT}`);
  });
}

// --- Export the Server ---
// This is what Vercel uses to run your serverless function
export default app;