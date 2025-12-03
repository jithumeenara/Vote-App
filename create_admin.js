import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://etbhvzsrduqjrptkwhsu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Ymh2enNyZHVxanJwdGt3aHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjQwMCwiZXhwIjoyMDc5OTkyNDAwfQ.z1DsmJss4CD3gOGpUeMW7FUNimO-_MdnTVYAQ4ebjC0';

const supabase = createClient(supabaseUrl, serviceKey);

async function createAdmin() {
    console.log('Creating admin user...');
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'jithulr44@gmail.com',
        password: 'Vote2login&',
        email_confirm: true
    });

    if (error) {
        console.error('Error creating user:', error.message);
    } else {
        console.log('User created successfully:', data.user.email);
    }
}

createAdmin();
