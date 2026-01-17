#!/usr/bin/env node
/**
 * Script สำหรับ Regenerate Supabase Types
 * ใช้ได้ทั้ง local และ remote
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔄 กำลัง Regenerate Supabase Types...\n');

// ตรวจสอบว่า Supabase CLI ติดตั้งแล้วหรือยัง
try {
  execSync('supabase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ ไม่พบ Supabase CLI');
  console.log('\n📦 วิธีติดตั้ง:');
  console.log('   npm install -g supabase');
  console.log('   หรือ');
  console.log('   brew install supabase/tap/supabase');
  process.exit(1);
}

// ตรวจสอบว่ามี local project หรือไม่
let useLocal = false;
try {
  const supabaseConfig = readFileSync(join(projectRoot, 'supabase', 'config.toml'), 'utf-8');
  if (supabaseConfig) {
    useLocal = true;
  }
} catch (error) {
  // ไม่มี local project
}

if (useLocal) {
  console.log('📦 ใช้ Local Database...\n');
  try {
    execSync('supabase gen types typescript --local > types/database.ts', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('\n✅ Regenerate Types สำเร็จ! (จาก Local Database)');
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.log('\n💡 ลองใช้ Remote Database แทน:');
    console.log('   npm run gen:types:remote');
    process.exit(1);
  }
} else {
  // ใช้ Remote Database
  const projectId = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;
  
  if (!projectId) {
    console.error('❌ ไม่พบ SUPABASE_PROJECT_ID');
    console.log('\n💡 วิธีแก้ไข:');
    console.log('   1. ตั้งค่า environment variable:');
    console.log('      export SUPABASE_PROJECT_ID=your-project-id');
    console.log('   2. หรือใช้ Supabase Dashboard:');
    console.log('      - ไปที่ Settings → API');
    console.log('      - คัดลอก Database types');
    console.log('      - วางใน types/database.ts');
    process.exit(1);
  }

  console.log('🌐 ใช้ Remote Database...\n');
  try {
    execSync(`supabase gen types typescript --project-id ${projectId} > types/database.ts`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('\n✅ Regenerate Types สำเร็จ! (จาก Remote Database)');
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.log('\n💡 ลองใช้ Supabase Dashboard แทน:');
    console.log('   1. ไปที่ https://app.supabase.com');
    console.log('   2. Settings → API → Database types');
    console.log('   3. Generate types → TypeScript');
    console.log('   4. คัดลอกและวางใน types/database.ts');
    process.exit(1);
  }
}

console.log('\n✨ เสร็จสิ้น! Types ถูกอัปเดตแล้ว');
