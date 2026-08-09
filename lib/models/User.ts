import mongoose, { Schema, Document } from 'mongoose';

export const BELTS = ['branca', 'azul', 'roxa', 'marrom', 'preta'] as const;
export const ROLES = ['admin', 'professor', 'aluno'] as const;

export type Belt = (typeof BELTS)[number];
export type Role = (typeof ROLES)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  birthDate: Date;
  role: Role;
  belt: Belt;
  degree: number;
  beltUpdatedAt: Date;
  emergencyContact: { name: string; phone: string };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    cpf: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    birthDate: { type: Date, required: true },
    role: { type: String, enum: ROLES, default: 'aluno' },
    belt: { type: String, enum: BELTS, default: 'branca' },
    degree: { type: Number, default: 0, min: 0, max: 4 },
    beltUpdatedAt: { type: Date, default: Date.now },
    emergencyContact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);
