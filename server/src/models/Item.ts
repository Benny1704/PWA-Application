import mongoose, { Schema, Document } from 'mongoose';

export interface IItem extends Document {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
  userId?: string;
}

const ItemSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  userId: { type: String },
  syncedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export default mongoose.model<IItem>('Item', ItemSchema);