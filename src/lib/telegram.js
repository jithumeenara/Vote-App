import { supabase } from './supabase';

let telegramConfigCache = null;

// Fetch Telegram Config (Token & Chat ID)
async function getTelegramConfig() {
    if (telegramConfigCache) return telegramConfigCache;

    try {
        // Try RPC first (Secure method for Ward Members)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_telegram_config');

        if (!rpcError && rpcData) {
            telegramConfigCache = rpcData;
            return rpcData;
        }
    } catch (e) {
        console.warn('RPC get_telegram_config failed, falling back to table query');
    }

    try {
        // Fallback to direct table query (Works for Admins if RLS allows)
        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', ['telegram_bot_token', 'telegram_chat_id']);

        if (error) throw error;

        const config = {};
        data.forEach(item => {
            config[item.key] = item.value;
        });

        if (config.telegram_bot_token && config.telegram_chat_id) {
            telegramConfigCache = config;
            return config;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Telegram config:', error);
        return null;
    }
}

// Send Message to Telegram
export async function sendTelegramAlert(message) {
    try {
        const config = await getTelegramConfig();
        if (!config) {
            console.warn('Telegram not configured');
            return;
        }

        const url = `https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`;
        const body = {
            chat_id: config.telegram_chat_id,
            text: message,
            parse_mode: 'HTML' // Allows bold/italic
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        if (!result.ok) {
            console.error('Telegram API Error:', result);
        }
    } catch (error) {
        console.error('Failed to send Telegram alert:', error);
    }
}

// Predefined Alert Templates
// Helper to get color emoji based on ward number
const getWardEmoji = (wardStr) => {
    if (!wardStr) return '⚪';
    // Extract number from string like "10 - WardName"
    const match = wardStr.match(/\d+/);
    const num = match ? parseInt(match[0]) : wardStr.length;

    const emojis = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '🟤', '⚫'];
    return emojis[num % emojis.length];
};

// Predefined Alert Templates
export const TelegramAlerts = {
    login: (user, role) => {
        const userDisplay = role === 'Admin' ? 'Super Admin' : user;
        return `🔐 <b>Login Alert</b>\nUser: ${userDisplay}\nRole: ${role}\nTime: ${new Date().toLocaleString('en-IN')}`;
    },

    newData: (type, details) => `📝 <b>New Data Added</b>\nType: ${type}\nDetails: ${details}\nTime: ${new Date().toLocaleString('en-IN')}`,

    voteMarked: (voterName, slNo, panchayat, ward, booth) => {
        const wardEmoji = getWardEmoji(ward);
        return `${wardEmoji} <b>Vote Marked</b>\n\n👤 Voter: ${voterName} (Sl.No: ${slNo})\n📍 Panchayat: ${panchayat}\n${wardEmoji} Ward: ${ward}\n🗳️ Booth: ${booth}\n🕒 Time: ${new Date().toLocaleString('en-IN')}`;
    },

    aiQuery: (user, question) => `🤖 <b>AI Assistant Query</b>\nUser: ${user}\nQuestion: "${question}"\nTime: ${new Date().toLocaleString('en-IN')}`
};
