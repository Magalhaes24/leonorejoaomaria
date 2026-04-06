-- Migration: Add site_content table for low-code site editor
-- Run this in the Supabase SQL editor at https://supabase.com/dashboard

CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'text',
  label text,
  section text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_content_pkey PRIMARY KEY (id),
  CONSTRAINT site_content_key_unique UNIQUE (key)
);

-- Enable Row Level Security
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read content (public website needs to read it)
CREATE POLICY "Public read site_content"
  ON public.site_content
  FOR SELECT
  USING (true);

-- Only the admin user can insert/update/delete
CREATE POLICY "Admin write site_content"
  ON public.site_content
  FOR ALL
  USING (auth.uid() = '0b9c93dd-17a2-4943-befd-968943ba432f'::uuid)
  WITH CHECK (auth.uid() = '0b9c93dd-17a2-4943-befd-968943ba432f'::uuid);
