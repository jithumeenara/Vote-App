import { supabase } from './supabase';
import OpenAI from 'openai';

let openAIKeyCache = null;

async function getOpenAIKey() {
    if (openAIKeyCache) return openAIKeyCache;

    try {
        // Try RPC first (Secure method for Ward Members)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_openai_key');

        if (!rpcError && rpcData) {
            openAIKeyCache = rpcData;
            return rpcData;
        }
    } catch (e) {
        console.warn('RPC get_openai_key failed, falling back to table query');
    }

    // Fallback to direct table query (Works for Admins if RLS allows)
    const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();

    if (error || !data || !data.value) {
        console.error('OpenAI API Key not found or empty');
        return null;
    }

    openAIKeyCache = data.value;
    return data.value;
}

export async function transliterateToMalayalam(text) {
    try {
        const apiKey = await getOpenAIKey();
        if (!apiKey) throw new Error('API Key not configured');

        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

        const prompt = `You are a smart search assistant for a Kerala Voter Database.
        The user has typed: "${text}"
        
        Your task:
        1. Identify the likely intended name(s), correcting any spelling errors (e.g., "Surshe" -> "Suresh").
        2. Convert these intended names into Malayalam script.
        3. Provide multiple variations for Malayalam (Chillaksharam, long/short vowels).
        4. Return a comma-separated list containing BOTH the corrected English names and the Malayalam variations.
        
        Return ONLY the comma-separated list. No explanations.
        
        Example Input: "Surshe"
        Example Output: Suresh, സുരേഷ്, സുരേഷ, സുരേഷൻ
        
        Example Input: "Jithu"
        Example Output: Jithu, ജിത്തു, ജിതു, ജിതൂ
        
        Example Input: "Arun"
        Example Output: Arun, അരുൺ, അരുൻ, അരുണ്‍
        
        Example Input: "Gokul"
        Example Output: Gokul, ഗോകുൽ, ഗോകുല്‍, ഗോകുല്`;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        const malayalamText = completion.choices[0].message.content.trim();

        return malayalamText.split(',').map(s => s.trim());
    } catch (error) {
        console.error('AI Error:', error);
        return [text]; // Fallback to original text
    }
}

export async function askDatabaseQuestion(question, contextData = null) {
    try {
        const apiKey = await getOpenAIKey();
        if (!apiKey) throw new Error('API Key not configured');

        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

        let prompt = `You are a helpful and intelligent AI assistant for a Voter Management System in Kerala.
        Your goal is to provide accurate, natural, and easy-to-understand answers to the user's questions.

        Important Instructions:
        1. Language: ALWAYS answer in clear, natural Malayalam (മലയാളം).
        2. Data Transliteration: The provided 'Context Data' contains names and addresses in English. You MUST transliterate these into Malayalam when presenting them.
           - Example: If context has "Name: Jithu, House: Vadakkethil", you should say "പേര്: ജിത്തു, വീട്ടുപേര്: വടക്കേതിൽ".
        3. Data Presentation:
           - Use bullet points for lists.
           - Format: "• [Malayalam Label]: [Malayalam Value]"
        4. Input Analysis: Understand Malayalam, Manglish, and English inputs.
        5. Tone: Polite, helpful, and respectful.
        6. Context: Use the provided 'Context Data' to answer. If the answer is NOT in the context, say "ക്ഷമിക്കണം, എനിക്ക് ആ വിവരം ലഭ്യമല്ല".

        User Question: "${question}"
        `;

        if (contextData) {
            prompt += `\nContext Data: ${JSON.stringify(contextData)}`;
        } else {
            prompt += `\nNote: If the user asks for specific data that you don't have in the context, politely explain that you can only answer based on the data provided or general knowledge.`;
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('AI Error:', error);
        if (error.message === 'API Key not configured' || error.message.includes('API Key')) {
            return "Error: OpenAI API Key is not configured. Please set it in Admin Settings.";
        }
        if (error.status === 429 || error.message.includes('quota')) {
            return "ക്ഷമിക്കണം, AI സേവനത്തിന്റെ പരിധി കഴിഞ്ഞിരിക്കുന്നു (Quota Exceeded). അഡ്മിനുമായി ബന്ധപ്പെടുക.";
        }
        return `ക്ഷമിക്കണം, ഒരു തകരാർ സംഭവിച്ചു: ${error.message}`;
    }
}

export async function parseUserQuery(question) {
    try {
        const apiKey = await getOpenAIKey();
        if (!apiKey) throw new Error('API Key not configured');

        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

        const prompt = `You are a database query parser for a Voter Management System.
        Your task is to convert the user's natural language question into a structured JSON object representing a database query.
        
        Database Schema:
        - voters: id, sl_no, id_card_no, name, gender ('Male', 'Female'), age, house_name, house_no, guardian_name, booth_id, status ('Active', 'delete', 'shifted')
        - booths: id, name, booth_no, ward_id
        - wards: id, name, ward_no, panchayat_id
        - candidates: id, name, party, ward_id

        Output JSON Format:
        {
            "type": "count" | "list" | "general",
            "table": "voters" | "booths" | "candidates" | "wards" | null,
            "filters": [
                { "column": "column_name", "operator": "eq" | "gt" | "lt" | "gte" | "lte" | "ilike", "value": "value" }
            ],
            "limit": number (default 5 for lists)
        }

        Rules:
        - If the question is a greeting or general question not requiring data, set "type": "general".
        - If the user asks "how many", set "type": "count".
        - If the user asks "list", "show", "details", "who is", "search", set "type": "list".
        - ALWAYS use "ilike" operator for 'name', 'house_name', 'guardian_name' to ensure case-insensitive partial matches.
        - Map "men" or "males" to gender='Male', "women" or "females" to gender='Female'.
        - Understand Manglish inputs (e.g., "Jithuvinte booth eth" -> search table='voters', name ilike 'Jithu').
        - IMPORTANT: The database stores names in English. If the user searches in Malayalam (e.g., "ജിത്തു"), transliterate it to English (e.g., "Jithu") for the 'value'.
        - If searching by ID Card, use 'id_card_no'. If searching by Serial Number, use 'sl_no'.
        - Return ONLY the JSON object. No markdown formatting.

        User Question: "${question}"
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        let text = completion.choices[0].message.content.trim();

        // Remove markdown code blocks if present
        if (text.startsWith('```json')) {
            text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        return JSON.parse(text);
    } catch (error) {
        console.error('AI Parse Error:', error);
        return { type: 'general' };
    }
}

export async function validateApiKey(apiKey) {
    try {
        if (!apiKey) return { isValid: false, error: 'Key is empty' };
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        await openai.models.list();
        return { isValid: true, error: null };
    } catch (error) {
        console.error('API Key Validation Error:', error);
        return { isValid: false, error: error.message };
    }
}
