import mongoose, { Schema, Document } from 'mongoose';

export interface IPhoto extends Document {
  class: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  takenAt: Date;
  caption?: string;

  /** Onde o arquivo mora: no Cloudinary ou no próprio MongoDB. */
  storage: 'cloudinary' | 'db';
  /** Preenchido quando storage === 'cloudinary'. */
  url?: string;
  publicId?: string;
  /** Preenchido quando storage === 'db'. Nunca vem nas listagens. */
  data?: Buffer;

  contentType: string;
  bytes: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<IPhoto>(
  {
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    takenAt: { type: Date, required: true },
    caption: { type: String, maxlength: 280 },

    storage: { type: String, enum: ['cloudinary', 'db'], required: true },
    url: { type: String },
    publicId: { type: String },
    data: { type: Buffer, select: false },

    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

photoSchema.index({ class: 1, takenAt: -1 });

export const Photo =
  mongoose.models.Photo || mongoose.model<IPhoto>('Photo', photoSchema);
