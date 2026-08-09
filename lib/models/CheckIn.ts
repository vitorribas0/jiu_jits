import mongoose, { Schema, Document } from 'mongoose';

export const APPROVALS = ['pendente', 'aprovado', 'recusado'] as const;
export type Approval = (typeof APPROVALS)[number];

export interface ICheckIn extends Document {
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  academy: mongoose.Types.ObjectId;
  checkInTime: Date;
  location: { latitude: number; longitude: number; accuracy?: number };
  distanceMeters: number;
  /** Pontualidade: se chegou dentro do horário da aula. */
  status: 'presente' | 'atrasado';
  /** Confirmação do professor. Só o aprovado conta na frequência. */
  approval: Approval;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const checkInSchema = new Schema<ICheckIn>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    academy: { type: Schema.Types.ObjectId, ref: 'Academy', required: true },
    checkInTime: { type: Date, required: true },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number },
    },
    distanceMeters: { type: Number, required: true },
    status: { type: String, enum: ['presente', 'atrasado'], default: 'presente' },
    approval: { type: String, enum: APPROVALS, default: 'pendente' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

checkInSchema.index({ student: 1, class: 1, checkInTime: 1 });
// Sustenta o contador de pendências que o professor vê no cabeçalho
checkInSchema.index({ class: 1, approval: 1 });

export const CheckIn =
  mongoose.models.CheckIn || mongoose.model<ICheckIn>('CheckIn', checkInSchema);
