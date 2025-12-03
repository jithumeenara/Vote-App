import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://etbhvzsrduqjrptkwhsu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Ymh2enNyZHVxanJwdGt3aHN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjQwMCwiZXhwIjoyMDc5OTkyNDAwfQ.z1DsmJss4CD3gOGpUeMW7FUNimO-_MdnTVYAQ4ebjC0';

const supabase = createClient(supabaseUrl, serviceKey);

async function setupTestVoter() {
    // Get a booth
    const { data: booths } = await supabase.from('booths').select('id').limit(1);
    if (!booths || booths.length === 0) {
        console.log('No booths found');
        return;
    }
    const boothId = booths[0].id;

    // Get a voter in that booth
    const { data: voters } = await supabase.from('voters').select('id, name').eq('booth_id', boothId).limit(1);
    if (!voters || voters.length === 0) {
        console.log('No voters found in booth ' + boothId);
        return;
    }
    const voter = voters[0];

    console.log(JSON.stringify({ boothId, voterId: voter.id, voterName: voter.name }));
}

setupTestVoter();
