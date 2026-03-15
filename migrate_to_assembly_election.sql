-- =============================================================
-- MIGRATION: Panchayat Election → Assembly Constituency Election
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- STEP 1: Rename 'panchayats' table → 'districts'
ALTER TABLE public.panchayats RENAME TO districts;

-- STEP 2: Rename 'wards' table → 'constituencies'
ALTER TABLE public.wards RENAME TO constituencies;

-- STEP 3: Rename columns on 'constituencies' (formerly 'wards')
ALTER TABLE public.constituencies RENAME COLUMN panchayat_id TO district_id;
ALTER TABLE public.constituencies RENAME COLUMN ward_no TO constituency_no;

-- STEP 4: Rename 'ward_id' → 'constituency_id' on 'booths'
ALTER TABLE public.booths RENAME COLUMN ward_id TO constituency_id;

-- STEP 5: Rename 'ward_id' → 'constituency_id' on 'candidates'
ALTER TABLE public.candidates RENAME COLUMN ward_id TO constituency_id;

-- =============================================================
-- STEP 6: Update RLS Policies that reference old column names
-- (Drop and recreate policies that hard-code 'ward_id' on booths)
-- =============================================================

-- Booths RLS: allow ward members to read booths in their constituency
DROP POLICY IF EXISTS "Ward members can read booths in their ward" ON public.booths;
DROP POLICY IF EXISTS "Allow ward members to read booths" ON public.booths;

CREATE POLICY "Ward members can read booths in their constituency" ON public.booths
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.ward_users wu
        WHERE wu.ward_id = booths.constituency_id
          AND wu.session_token = (current_setting('request.headers', true)::json->>'x-ward-token')::uuid
    )
    OR auth.role() = 'authenticated'
);

-- =============================================================
-- STEP 7: Update the ward_get_voters RPC to use new column name
-- (Only needed if the function body references booths.ward_id)
-- =============================================================

-- Check existing function body first; update if it references old column names.
-- Example fix (adjust to match your actual function body):

CREATE OR REPLACE FUNCTION public.ward_get_voters(token uuid, booth_id_input uuid)
RETURNS SETOF public.voters
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ward_id uuid;
BEGIN
    -- Validate session token
    SELECT ward_id INTO v_ward_id
    FROM public.ward_users
    WHERE session_token = token AND is_active = true;

    IF v_ward_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Check that requested booth belongs to this constituency
    IF NOT EXISTS (
        SELECT 1 FROM public.booths
        WHERE id = booth_id_input AND constituency_id = v_ward_id
    ) THEN
        RAISE EXCEPTION 'Access denied: booth not in your constituency';
    END IF;

    RETURN QUERY
    SELECT * FROM public.voters
    WHERE booth_id = booth_id_input
    ORDER BY sl_no;
END;
$$;

-- =============================================================
-- STEP 8: Update ward_upload_voters RPC
-- =============================================================

CREATE OR REPLACE FUNCTION public.ward_upload_voters(token uuid, booth_id_input uuid, voters_json jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ward_id uuid;
    voter_record jsonb;
BEGIN
    -- Validate session token
    SELECT ward_id INTO v_ward_id
    FROM public.ward_users
    WHERE session_token = token AND is_active = true;

    IF v_ward_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Check booth belongs to this constituency
    IF NOT EXISTS (
        SELECT 1 FROM public.booths
        WHERE id = booth_id_input AND constituency_id = v_ward_id
    ) THEN
        RAISE EXCEPTION 'Access denied: booth not in your constituency';
    END IF;

    -- Insert voters
    FOR voter_record IN SELECT * FROM jsonb_array_elements(voters_json)
    LOOP
        INSERT INTO public.voters (
            booth_id, sl_no, name, guardian_name,
            house_no, house_name, gender, age, id_card_no
        ) VALUES (
            booth_id_input,
            (voter_record->>'sl_no')::integer,
            voter_record->>'name',
            voter_record->>'guardian_name',
            voter_record->>'house_no',
            voter_record->>'house_name',
            voter_record->>'gender',
            (voter_record->>'age')::integer,
            voter_record->>'id_card_no'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

-- =============================================================
-- STEP 9: Refresh schema cache (Supabase PostgREST)
-- Run this after the migration to ensure the API picks up changes
-- =============================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- =============================================================

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'constituencies' AND table_schema = 'public';

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'booths' AND table_schema = 'public';
