import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://etbhvzsrduqjrptkwhsu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Ymh2enNyZHVxanJwdGt3aHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjQwMCwiZXhwIjoyMDc5OTkyNDAwfQ.z1DsmJss4CD3gOGpUeMW7FUNimO-_MdnTVYAQ4ebjC0';

const supabase = createClient(supabaseUrl, serviceKey);

const voterId = '1ed95568-1077-46d5-958e-74f73f5665f1';

async function setStatus(status) {
    const { error } = await supabase.from('voters').update({ status }).eq('id', voterId);
    if (error) console.error(error);
    else console.log('Status updated to ' + status);
}

const status = process.argv[2];
setStatus(status);
