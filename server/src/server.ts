import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import itemRoutes from './routes/items';

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection with connection caching for Vercel
let cachedDb: typeof mongoose | null = null;

async function connectToDatabase() {
  if (cachedDb && cachedDb.connection.readyState === 1) {
    return cachedDb;
  }

  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('❌ MONGODB_URI environment variable is not set.');
  }

  try {
    cachedDb = await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
    console.log('✅ Connected to MongoDB');
    return cachedDb;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed' 
    });
  }
});

// Routes
app.use('/api/items', itemRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root API route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'PWA API is running',
    endpoints: ['/api/health', '/api/items']
  });
});

// Start server for local development only
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  connectToDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  });
}

// Export for Vercel
export default app;