-- =====================================================
-- BOOTH USERS - Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create booth_users table
CREATE TABLE IF NOT EXISTS public.booth_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    booth_id uuid REFERENCES public.booths(id) ON DELETE CASCADE,
    session_token uuid,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.booth_users ENABLE ROW LEVEL SECURITY;

-- 3. Only service role / SECURITY DEFINER functions can access
DROP POLICY IF EXISTS "booth_users_service_only" ON public.booth_users;
CREATE POLICY "booth_users_service_only" ON public.booth_users
    USING (false) WITH CHECK (false);

-- 4. Login function
CREATE OR REPLACE FUNCTION public.login_booth_user(
    username_input text,
    password_input text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user public.booth_users;
    v_token uuid;
    v_booth record;
BEGIN
    SELECT * INTO v_user
    FROM public.booth_users
    WHERE username = username_input AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid credentials';
    END IF;

    IF v_user.password_hash != crypt(password_input, v_user.password_hash) THEN
        RAISE EXCEPTION 'Invalid credentials';
    END IF;

    v_token := gen_random_uuid();
    UPDATE public.booth_users SET session_token = v_token WHERE id = v_user.id;

    -- Get booth details
    SELECT b.booth_no, b.name, b.constituency_id INTO v_booth
    FROM public.booths b WHERE b.id = v_user.booth_id;

    RETURN jsonb_build_object(
        'id', v_user.id,
        'username', v_user.username,
        'booth_id', v_user.booth_id,
        'booth_no', v_booth.booth_no,
        'booth_name', v_booth.name,
        'constituency_id', v_booth.constituency_id,
        'session_token', v_token,
        'role', 'booth_member'
    );
END;
$$;

-- 5. Create booth user (admin use)
CREATE OR REPLACE FUNCTION public.create_booth_user(
    username_input text,
    password_input text,
    booth_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.booth_users (username, password_hash, booth_id)
    VALUES (username_input, crypt(password_input, gen_salt('bf')), booth_id_input);
END;
$$;

-- 6. Update booth user password (admin use)
CREATE OR REPLACE FUNCTION public.update_booth_user_password(
    user_id_input uuid,
    new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.booth_users
    SET password_hash = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id_input;
END;
$$;

-- Done! Now go to the app and:
-- 1. Add Booth login type in Login page
-- 2. Manage booth users in Admin > Manage > Booth Members
