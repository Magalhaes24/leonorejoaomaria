import { createClient } from '@supabase/supabase-js'

// Schema used by the app:
//
// CREATE TABLE public.alergias (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   nome text NOT NULL,
//   restricoes text[] NOT NULL DEFAULT '{}'::text[],
//   notas text,
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT alergias_pkey PRIMARY KEY (id)
// );
//
// CREATE TABLE public.boleias (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   nome text NOT NULL,
//   telefone text,
//   lugares integer NOT NULL DEFAULT 1 CHECK (lugares >= 1),
//   sentido text NOT NULL,
//   notas text,
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT boleias_pkey PRIMARY KEY (id)
// );
//
// CREATE TABLE public.gift_contributions (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   gift_id uuid NOT NULL,
//   contributor_name text NOT NULL,
//   amount numeric NOT NULL CHECK (amount > 0::numeric),
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT gift_contributions_pkey PRIMARY KEY (id),
//   CONSTRAINT gift_contributions_gift_id_fkey FOREIGN KEY (gift_id) REFERENCES public.gifts(id)
// );
//
// CREATE TABLE public.gifts (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   name text NOT NULL,
//   description text,
//   price numeric NOT NULL,
//   image_url text,
//   category text,
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT gifts_pkey PRIMARY KEY (id)
// );
//
// CREATE TABLE public.honeymoon_contributions (
//   id uuid NOT NULL DEFAULT gen_random_uuid(),
//   contributor_name text NOT NULL,
//   message text,
//   amount numeric NOT NULL CHECK (amount >= 0::numeric),
//   created_at timestamp with time zone DEFAULT now(),
//   CONSTRAINT honeymoon_contributions_pkey PRIMARY KEY (id)
// );
//
// Admin insert/update/delete policies should target:
// auth.uid() = '0b9c93dd-17a2-4943-befd-968943ba432f'

const SUPABASE_URL = 'https://ozrnwqvvhtqtwtaiymow.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_rwYPE2_hbM5h0KCu7J6Uxw_pR48PjhQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface Gift {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
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

export interface Boleia {
  id?: string
  nome: string
  telefone?: string | null
  lugares: number
  sentido: string
  notas?: string | null
  created_at?: string
}

export interface Alergia {
  id?: string
  nome: string
  restricoes: string[]
  notas?: string | null
  created_at?: string
}
