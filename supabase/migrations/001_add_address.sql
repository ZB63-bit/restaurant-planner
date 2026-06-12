-- Add address column to suggestions and history.
-- Run this in the Supabase SQL Editor for existing projects.
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE history     ADD COLUMN IF NOT EXISTS address text;
