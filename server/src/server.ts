import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import itemRoutes from './routes/items';

dotenv.config();

const app = express();

// --- MongoDB Connection ---
// In a serverless environment, you connect at the top level.
// This connection can be reused across multiple function invocations.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://benny:Benny@1917@pwa.2s516ib.mongodb.net/?appName=Pwa';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    // It's crucial to log this, as a failed connection will cause your API to fail.
  });

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

// --- Export the Server ---
// This is the *most important* change.
// Instead of app.listen(), you export the express app instance.
// Vercel automatically handles the server creation and port listening.
export default app;