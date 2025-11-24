// Test Supabase Connection Script
// Run this with: node test-supabase-connection.js

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ NOT SET');
console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : '❌ NOT SET');
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Please check your .env.local file');
  process.exit(1);
}

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.error('❌ Using placeholder credentials');
  console.error('Please update .env.local with real Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('1. Testing Supabase Auth Health...');
    const { data: healthData, error: healthError } = await supabase.auth.getSession();
    if (healthError) {
      console.log('   ⚠️  Auth health check:', healthError.message);
    } else {
      console.log('   ✅ Auth service accessible');
    }

    console.log('\n2. Testing Database Connection (vehicles table)...');
    const startTime = Date.now();
    const { data, error, count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    const elapsed = Date.now() - startTime;
    
    if (error) {
      console.error('   ❌ Error:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error details:', error.details);
      console.error('   Error hint:', error.hint);
      return false;
    }
    
    console.log(`   ✅ Connection successful! (${elapsed}ms)`);
    console.log(`   📊 Vehicles count: ${count || 0}`);
    return true;
  } catch (err) {
    console.error('   ❌ Fatal error:', err.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n✅ Supabase connection test PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ Supabase connection test FAILED');
    console.log('\nPossible issues:');
    console.log('1. Check .env.local file location (must be in project root)');
    console.log('2. Verify Supabase URL and Key are correct');
    console.log('3. Check network/VPN settings');
    console.log('4. Verify Supabase project is active');
    process.exit(1);
  }
});

