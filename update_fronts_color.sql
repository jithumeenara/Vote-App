-- Add color column to fronts table
ALTER TABLE public.fronts 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#666666';

-- Update default fronts with standard colors
UPDATE public.fronts SET color = '#ef4444' WHERE name = 'LDF';
UPDATE public.fronts SET color = '#3b82f6' WHERE name = 'UDF';
UPDATE public.fronts SET color = '#f97316' WHERE name = 'NDA';
UPDATE public.fronts SET color = '#8b5cf6' WHERE name = 'Other';
