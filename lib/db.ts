import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_KEY não configuradas no .env.local');
}

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function connectDB() {
  // Supabase auto-reconecta; esta função fica por compatibilidade
  return db;
}
