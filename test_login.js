import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Hardcode for testing if env fails, or try to read from process.env
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

console.log("URL:", supabaseUrl);
// console.log("Key:", supabaseKey); // Don't log key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log("Attempting login...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'ward1_user@vote.local',
        password: 'password123'
    });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    console.log("Auth Successful. User ID:", authData.user.id);

    console.log("Fetching Profile...");
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.error("Profile Fetch Error:", profileError);
    } else {
        console.log("Profile Fetched:", profile);
    }
}

testLogin();
