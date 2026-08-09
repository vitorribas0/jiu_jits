import mongoose, { Schema, Document } from 'mongoose';

export const DAYS = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const;

export type Day = (typeof DAYS)[number];

export interface IClass extends Document {
  name: string;
  description?: string;
  professor: mongoose.Types.ObjectId;
  academy: mongoose.Types.ObjectId;
  days: Day[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  students: mongoose.Types.ObjectId[];
  /** Imagem da turma. Mesma estratégia das fotos: Cloudinary ou no Mongo. */
  image?: {
    storage: 'cloudinary' | 'db';
    url?: string;
    publicId?: string;
    data?: Buffer;
    contentType: string;
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true },
    description: { type: String },
    professor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    academy: { type: Schema.Types.ObjectId, ref: 'Academy', required: true },
    days: [{ type: String, enum: DAYS, required: true }],
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    maxStudents: { type: Number },
    students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    image: {
      storage: { type: String, enum: ['cloudinary', 'db'] },
      url: { type: String },
      publicId: { type: String },
      // `select: false`: os bytes nunca sobem junto com a listagem de turmas
      data: { type: Buffer, select: false },
      contentType: { type: String },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Class =
  mongoose.models.Class || mongoose.model<IClass>('Class', classSchema);
