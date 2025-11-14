import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

const test = async (req: VercelRequest, res: VercelResponse) => {
  await mongoose.connect('test');
  res.json({ ok: true });
};