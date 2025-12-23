
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmails() {
    const { data, error } = await supabase.from('profiles').select('email').limit(20);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Registered Emails:');
    data.forEach(p => console.log(`- "${p.email}"`));
}

checkEmails();
