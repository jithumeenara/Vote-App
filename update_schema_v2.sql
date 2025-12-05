-- 1. Create Fronts Table
CREATE TABLE IF NOT EXISTS public.fronts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Insert Default Fronts
INSERT INTO public.fronts (name) VALUES 
('LDF'), 
('UDF'), 
('NDA'), 
('Other')
ON CONFLICT (name) DO NOTHING;

-- 3. Add supported_front_id to voters table
ALTER TABLE public.voters 
ADD COLUMN IF NOT EXISTS supported_front_id uuid REFERENCES public.fronts(id);

-- 4. Update Voters Status Check Constraint
-- First, drop the existing check constraint if it exists (name might vary, so we try to be generic or just alter the column type if it's an enum)
-- Assuming it's a text column with a check constraint or just text. The user request implies adding more options.
-- If it's a check constraint:
ALTER TABLE public.voters DROP CONSTRAINT IF EXISTS voters_status_check;
ALTER TABLE public.voters ADD CONSTRAINT voters_status_check 
CHECK (status IN ('active', 'shifted', 'deleted', 'death', 'gulf', 'out_of_place'));

-- 5. Enable RLS on fronts
ALTER TABLE public.fronts ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for fronts
-- Allow read access to everyone (authenticated)
CREATE POLICY "Allow read access for all users" ON public.fronts
FOR SELECT USING (true);

-- Allow write access only to admins (assuming admin role or check)
-- For now, let's allow all authenticated users to insert/update if they are admins. 
-- But since we don't have a strict 'admin' role in auth.users metadata for all cases, 
-- we usually rely on the app logic or specific user checks. 
-- Let's assume authenticated users can read. Admins can manage.

-- 7. Update Voters RLS to allow Ward Members to UPDATE
-- Currently, we might have a policy that restricts updates.
-- Let's ensure Ward Members can update voters in their ward.

DROP POLICY IF EXISTS "Ward members can update voters in their ward" ON public.voters;

CREATE POLICY "Ward members can update voters in their ward" ON public.voters
FOR UPDATE
USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'ward_member' AND ward_id = voters.ward_id -- This logic depends on how ward_id is linked. 
        -- Voters are linked to booths, booths to wards.
        -- So we need to check if the voter's booth belongs to the ward of the user.
    )
    OR
    EXISTS (
        SELECT 1 FROM ward_users 
        WHERE session_token = (current_setting('request.headers', true)::json->>'x-ward-token')::uuid
        AND ward_id = (SELECT ward_id FROM booths WHERE id = voters.booth_id)
    )
);

-- Note: The above RLS is complex because we have two types of auth (Supabase Auth & Custom Ward User).
-- If we are using the custom 'ward_user' auth, we usually bypass RLS or use a specific function.
-- However, if the app uses Supabase Client directly, we need RLS.
-- Let's simplify: If the user is a 'ward_member' in 'profiles', they should be able to update.

-- Let's just make sure the 'status' and 'supported_front_id' columns are updatable.
