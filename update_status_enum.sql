-- Update Voters Status Check Constraint to include 'duplicate'
ALTER TABLE public.voters DROP CONSTRAINT IF EXISTS voters_status_check;
ALTER TABLE public.voters ADD CONSTRAINT voters_status_check 
CHECK (status IN ('active', 'shifted', 'deleted', 'death', 'gulf', 'out_of_place', 'duplicate'));
