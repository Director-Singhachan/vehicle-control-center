# Script สำหรับ Deploy Telegram Webhook Function
# ใช้ Supabase CLI ผ่าน npx

Write-Host "=== Deploy Telegram Webhook Function ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "Step 1: Login to Supabase..." -ForegroundColor Yellow
Write-Host "โปรดเปิด browser และ login เมื่อมี prompt" -ForegroundColor Gray
npx supabase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Login failed. Please try again." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Login successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Link Project
Write-Host "Step 2: Linking project..." -ForegroundColor Yellow
Write-Host "โปรดใส่ Database password เมื่อมี prompt" -ForegroundColor Gray
# ใช้ Project Reference จาก Environment Variable หรือแก้ไขที่นี่
$PROJECT_REF = $env:SUPABASE_PROJECT_REF
if (-not $PROJECT_REF) {
    Write-Host "⚠️  ไม่พบ SUPABASE_PROJECT_REF ใน Environment Variables" -ForegroundColor Yellow
    Write-Host "กรุณาตั้งค่า SUPABASE_PROJECT_REF หรือแก้ไขไฟล์นี้" -ForegroundColor Yellow
    exit 1
}

npx supabase link --project-ref $PROJECT_REF

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Link failed. Please check your project-ref and password." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Project linked!" -ForegroundColor Green
Write-Host ""

# Step 3: Deploy Function
Write-Host "Step 3: Deploying telegram-webhook function..." -ForegroundColor Yellow
npx supabase functions deploy telegram-webhook

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deploy failed. Please check the error message above." -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Deploy successful!" -ForegroundColor Green
Write-Host ""

# Step 4: Test Webhook
Write-Host "Step 4: Testing webhook..." -ForegroundColor Yellow
Write-Host "ตรวจสอบ webhook info:" -ForegroundColor Gray
# ใช้ Telegram Bot Token จาก Environment Variable
$TELEGRAM_BOT_TOKEN = $env:TELEGRAM_BOT_TOKEN
if ($TELEGRAM_BOT_TOKEN) {
    Write-Host "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  ไม่พบ TELEGRAM_BOT_TOKEN ใน Environment Variables" -ForegroundColor Yellow
    Write-Host "กรุณาตั้งค่า TELEGRAM_BOT_TOKEN หรือตรวจสอบ webhook info ใน Supabase Dashboard" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "[SUCCESS] Done! Check the webhook info above." -ForegroundColor Green

