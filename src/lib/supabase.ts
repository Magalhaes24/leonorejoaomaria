import { createClient } from '@supabase/supabase-js'

// ─── SQL para o Supabase SQL Editor ──────────────────────────────────────────
//
// CREATE TABLE gifts (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   name TEXT NOT NULL,
//   description TEXT,
//   price NUMERIC(10,2) NOT NULL,
//   image_url TEXT,
//   category TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE gift_contributions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   gift_id UUID NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
//   contributor_name TEXT NOT NULL,
//   amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE honeymoon_contributions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   contributor_name TEXT NOT NULL,
//   message TEXT,
//   amount NUMERIC(10,2) NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE boleias (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   nome TEXT NOT NULL,
//   telefone TEXT,
//   lugares INTEGER NOT NULL DEFAULT 1,
//   sentido TEXT NOT NULL,
//   notas TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE alergias (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   nome TEXT NOT NULL,
//   restricoes TEXT[] NOT NULL DEFAULT '{}',
//   notas TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- RLS
// ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
// ALTER TABLE gift_contributions ENABLE ROW LEVEL SECURITY;
// ALTER TABLE honeymoon_contributions ENABLE ROW LEVEL SECURITY;
// ALTER TABLE boleias ENABLE ROW LEVEL SECURITY;
// ALTER TABLE alergias ENABLE ROW LEVEL SECURITY;
//
// -- Public policies
// CREATE POLICY "Anyone can view gifts" ON gifts FOR SELECT USING (true);
// CREATE POLICY "Anyone can view gift contributions" ON gift_contributions FOR SELECT USING (true);
// CREATE POLICY "Anyone can add gift contributions" ON gift_contributions FOR INSERT WITH CHECK (true);
// CREATE POLICY "Anyone can add contributions" ON honeymoon_contributions FOR INSERT WITH CHECK (true);
// CREATE POLICY "Anyone can add boleias" ON boleias FOR INSERT WITH CHECK (true);
// CREATE POLICY "Anyone can add alergias" ON alergias FOR INSERT WITH CHECK (true);
//
// -- Admin policies (locked to user ID cbac1305-f8b7-4b2a-85fa-c8200b9f88e1)
// -- Drop old policies first if they exist, then recreate:
// DROP POLICY IF EXISTS "Admin can insert gifts" ON gifts;
// DROP POLICY IF EXISTS "Admin can update gifts" ON gifts;
// DROP POLICY IF EXISTS "Admin can delete gifts" ON gifts;
// DROP POLICY IF EXISTS "Admin can delete contributions" ON gift_contributions;
// CREATE POLICY "Admin can insert gifts" ON gifts FOR INSERT WITH CHECK (auth.uid() = 'cbac1305-f8b7-4b2a-85fa-c8200b9f88e1');
// CREATE POLICY "Admin can update gifts" ON gifts FOR UPDATE USING (auth.uid() = 'cbac1305-f8b7-4b2a-85fa-c8200b9f88e1');
// CREATE POLICY "Admin can delete gifts" ON gifts FOR DELETE USING (auth.uid() = 'cbac1305-f8b7-4b2a-85fa-c8200b9f88e1');
// CREATE POLICY "Admin can delete contributions" ON gift_contributions FOR DELETE USING (auth.uid() = 'cbac1305-f8b7-4b2a-85fa-c8200b9f88e1');

const SUPABASE_URL = 'https://ozrnwqvvhtqtwtaiymow.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_rwYPE2_hbM5h0KCu7J6Uxw_pR48PjhQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface Gift {
  id: string
  name: string
  description: string
  price: number
  image_url: string | null
  category: string
  created_at: string
}

export interface GiftContribution {
  id?: string
  gift_id: string
  contributor_name: string
  amount: number
  created_at?: string
}

export interface HoneymoonContribution {
  id?: string
  contributor_name: string
  message?: string
  amount: number
  created_at?: string
}
