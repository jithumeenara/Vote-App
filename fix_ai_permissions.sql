-- Create a secure function to get the OpenAI API Key
-- This allows authenticated users (like Ward Members) to access the key
-- without giving them full access to the system_settings table.

CREATE OR REPLACE FUNCTION get_openai_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT value FROM system_settings WHERE key = 'openai_api_key');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_openai_key TO authenticated;
GRANT EXECUTE ON FUNCTION get_openai_key TO anon;
