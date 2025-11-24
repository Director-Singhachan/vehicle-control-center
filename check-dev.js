// Quick check script for dev server issues
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 กำลังตรวจสอบการตั้งค่า...\n');

// Check 1: .env.local file
const envPath = join(__dirname, '.env.local');
if (!existsSync(envPath)) {
  console.log('❌ ไม่พบไฟล์ .env.local');
  console.log('   → สร้างไฟล์ .env.local และกรอก Supabase credentials\n');
} else {
  console.log('✅ พบไฟล์ .env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  if (!envContent.includes('VITE_SUPABASE_URL') || !envContent.includes('VITE_SUPABASE_ANON_KEY')) {
    console.log('⚠️  ไฟล์ .env.local ไม่มี VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY');
  } else {
    const hasUrl = envContent.includes('VITE_SUPABASE_URL=https://') && !envContent.includes('your-project-id');
    const hasKey = envContent.includes('VITE_SUPABASE_ANON_KEY=') && !envContent.includes('your-anon-key-here');
    if (hasUrl && hasKey) {
      console.log('✅ Environment variables ถูกตั้งค่าแล้ว\n');
    } else {
      console.log('⚠️  Environment variables ยังไม่ได้ตั้งค่าหรือใช้ค่า default\n');
    }
  }
}

// Check 2: Required files
const requiredFiles = [
  'index.html',
  'index.tsx',
  'src/index.css',
  'lib/supabase.ts',
  'package.json'
];

console.log('\n📁 ตรวจสอบไฟล์ที่จำเป็น:');
requiredFiles.forEach(file => {
  const filePath = join(__dirname, file);
  if (existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - ไม่พบไฟล์!`);
  }
});

console.log('\n💡 คำแนะนำ:');
console.log('1. ตรวจสอบว่า dev server รันอยู่ (npm run dev)');
console.log('2. เปิด Browser Console (F12) และดู error messages');
console.log('3. ตรวจสอบว่าเปิด URL ที่ถูกต้อง (ดูใน terminal)');
console.log('4. ดูเอกสาร: docs/TROUBLESHOOTING_BLANK_PAGE.md');
console.log('5. ทดสอบ connection ใน Browser Console:');
console.log('   const { data, error } = await supabase.from("vehicles").select("id").limit(1);');
console.log('   console.log("Test result:", data, error);\n');

