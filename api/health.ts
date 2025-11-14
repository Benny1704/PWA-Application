import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

let isConnected = false;

async function checkDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return 'connected';
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    return 'no_uri';
  }

  try {
    if (!isConnected) {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
    }
    return 'connected';
  } catch (error) {
    console.error('Health check DB error:', error);
    return 'error';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbStatus = await checkDatabase();

  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    environment: process.env.VERCEL ? 'production' : 'development'
  });
}