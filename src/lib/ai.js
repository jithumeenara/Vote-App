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
            model: "gpt-4o",
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

        let prompt = `### ROLE AND OBJECTIVE
You are an intelligent and professional Data Assistant powered by AI. Your goal is to assist users by analyzing data from a Supabase database and answering their questions accurately.

### KEY RESPONSIBILITIES
1.  **Analyze Data:** You will receive database schema information and/or retrieved data context. Use this to interpret the user's query.
2.  **Language Requirement:** You must answer the user's final question in **Professional Malayalam (മലയാളം)**.
3.  **Tone:** Maintain a formal, polite, and helpful tone (similar to a banking or government service official in Kerala).

### DATABASE CONTEXT
You have access to the following Supabase Table Schema:
- voters: id, booth_id, sl_no, name, guardian_name, house_name, age, gender, id_card_no, house_no, status, has_voted
- booths: id, ward_id, booth_no, name
- wards: id, panchayat_id, ward_no, name
- panchayats: id, name
- candidates: id, ward_id, name, photo_url, symbol_url, front, quote
- profiles: id, role, ward_id
- system_settings: key, value, description
- ward_users: id, username, panchayat_id, ward_id, is_active

### OPERATIONAL GUIDELINES
1.  **Accuracy:** specific facts must be based strictly on the provided database context. Do not hallucinate or invent data.
2.  **Privacy:** Do not reveal sensitive fields (like passwords or API keys) even if they exist in the schema.
3.  **Formatting:** Use bullet points or tables to present data clearly.
4.  **Unknown Answers:** If the database does not contain the answer, politely inform the user in Malayalam that the information is unavailable.

### TRANSLATION STYLE GUIDE (MALAYALAM)
-   Do not use colloquial or slang Malayalam.
-   Use clear, grammatically correct, formal Malayalam.
-   **Example Greeting:** instead of "Hi", use "നമസ്കാരം" (Namaskaram).
-   **Example Data Presentation:** "താങ്കൾ ആവശ്യപ്പെട്ട വിവരങ്ങൾ താഴെ നൽകുന്നു" (Here is the information you requested).

User Question: "${question}"
`;

        if (contextData) {
            prompt += `\n### RETRIEVED DATA CONTEXT\n${JSON.stringify(contextData, null, 2)}`;
        } else {
            prompt += `\nNote: If the user asks for specific data that you don't have in the context, politely explain that you can only answer based on the data provided or general knowledge.`;
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-4o",
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
        
        ### DATABASE SCHEMA
        - voters: id, booth_id, sl_no, name, guardian_name, house_name, age, gender, id_card_no, house_no, status, has_voted
        - booths: id, ward_id, booth_no, name
        - wards: id, panchayat_id, ward_no, name
        - panchayats: id, name
        - candidates: id, ward_id, name, photo_url, symbol_url, front, quote
        - profiles: id, role, ward_id
        - system_settings: key, value, description
        - ward_users: id, username, panchayat_id, ward_id, is_active

        Output JSON Format:
        {
            "type": "count" | "list" | "general",
            "table": "voters" | "booths" | "candidates" | "wards" | "panchayats" | null,
            "filters": [
                { "column": "column_name", "operator": "eq" | "gt" | "lt" | "gte" | "lte" | "ilike", "value": "value" }
            ],
            "limit": number (default 5 for lists)
        }

        Rules:
        - If the question is a greeting or general question not requiring data, set "type": "general".
        - If the user asks "how many", "count", "total", "ethra", "ennam", "എത്ര", "എണ്ണം", set "type": "count".
        - If the user asks "list", "show", "details", "who is", "search", "aarokke", "evide", set "type": "list".
        - ALWAYS use "ilike" operator for 'name', 'house_name', 'guardian_name', 'party', 'front' to ensure case-insensitive partial matches.
        - Map Malayalam/Manglish gender terms to database values:
            - "male", "mail", "aanu", "aanungal", "purushanmar", "men", "males", "മെയിൽ", "ആണുങ്ങൾ", "പുരുഷന്മാർ", "പുരുഷൻമാർ" -> gender='Male'
            - "female", "femail", "pennu", "pennungal", "sthreekal", "women", "females", "ഫീമെയിൽ", "പെണ്ണുങ്ങൾ", "സ്ത്രീകൾ" -> gender='Female'
        - If the query implies looking for people/voters (e.g., asking about gender, age, house), default to "table": "voters".
        - Understand Manglish inputs (e.g., "Jithuvinte booth eth" -> search table='voters', name ilike 'Jithu').
        - IMPORTANT: The database stores names in English. If the user searches in Malayalam (e.g., "ജിത്തു"), transliterate it to English (e.g., "Jithu") for the 'value'.
        - If searching by ID Card, use 'id_card_no'. If searching by Serial Number, use 'sl_no'.
        - Return ONLY the JSON object. No markdown formatting.

        Examples:
        - "പുരുഷന്മാർ എത്ര എണ്ണം" -> { "type": "count", "table": "voters", "filters": [{ "column": "gender", "operator": "eq", "value": "Male" }] }
        - "സ്ത്രീകൾ എത്ര" -> { "type": "count", "table": "voters", "filters": [{ "column": "gender", "operator": "eq", "value": "Female" }] }
        - "ജിത്തുവിന്റെ ബൂത്ത് ഏതാണ്" -> { "type": "list", "table": "voters", "filters": [{ "column": "name", "operator": "ilike", "value": "Jithu" }] }

        User Question: "${question}"
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-4o",
        });

        let text = completion.choices[0].message.content.trim();

        // Robust JSON extraction
        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');

        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            text = text.substring(jsonStartIndex, jsonEndIndex + 1);
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
