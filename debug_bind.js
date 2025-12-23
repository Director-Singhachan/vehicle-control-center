
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugBind() {
    const emailToSearch = 'pepsiston@gmail.com';
    console.log(`Searching for: "${emailToSearch}"`);

    // Try exact match
    const { data: exact, error: errorExact } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('email', emailToSearch)
        .maybeSingle();

    console.log('Exact Match Result:', exact);
    if (errorExact) console.error('Exact Match Error:', errorExact);

    // Try ilike
    const { data: ilikeResult, error: errorIlike } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .ilike('email', emailToSearch)
        .maybeSingle();

    console.log('Ilike Match Result:', ilikeResult);

    // Partial match search
    const { data: partial, error: errorPartial } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', '%pepsi%');

    console.log('Partial Results (%pepsi%):', partial);

    // List all emails
    const { data: all, error: errorAll } = await supabase
        .from('profiles')
        .select('email')
        .limit(50);

    console.log('All profile emails (first 50):', all?.map(p => p.email));
}

debugBind();
