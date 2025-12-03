-- Allow authenticated users (Ward Members) to read telegram settings
-- This is required for them to send alerts (e.g., when marking a vote)

CREATE OR REPLACE FUNCTION get_telegram_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bot_token text;
    chat_id text;
BEGIN
    SELECT value INTO bot_token FROM system_settings WHERE key = 'telegram_bot_token';
    SELECT value INTO chat_id FROM system_settings WHERE key = 'telegram_chat_id';
    
    IF bot_token IS NOT NULL AND chat_id IS NOT NULL THEN
        RETURN json_build_object('telegram_bot_token', bot_token, 'telegram_chat_id', chat_id);
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_telegram_config TO authenticated;
GRANT EXECUTE ON FUNCTION get_telegram_config TO anon;
