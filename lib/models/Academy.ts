import mongoose, { Schema, Document } from 'mongoose';

export interface IAcademy extends Document {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  checkInRadius: number; // metros permitidos para check-in
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const academySchema = new Schema<IAcademy>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    checkInRadius: { type: Number, default: 150 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Academy =
  mongoose.models.Academy || mongoose.model<IAcademy>('Academy', academySchema);
