import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://etbhvzsrduqjrptkwhsu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Ymh2enNyZHVxanJwdGt3aHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjQwMCwiZXhwIjoyMDc5OTkyNDAwfQ.z1DsmJss4CD3gOGpUeMW7FUNimO-_MdnTVYAQ4ebjC0';

const supabase = createClient(supabaseUrl, serviceKey);

async function setupTestVoter() {
    const { data: voters } = await supabase.from('voters').select('id, booth_id').limit(1);
    if (voters && voters.length > 0) {
        console.log('BOOTH:' + voters[0].booth_id);
        console.log('VOTER:' + voters[0].id);
    }
}

setupTestVoter();
