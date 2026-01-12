# PowerShell script สำหรับทดสอบ daily-summary-worker
# Usage: .\scripts\test-daily-summary.ps1 [date]
# Example: .\scripts\test-daily-summary.ps1 2025-01-15

param(
    [string]$Date = ""
)

# ตั้งค่า URL และ Key จาก Environment Variables
$SUPABASE_URL = $env:VITE_SUPABASE_URL
$SUPABASE_ANON_KEY = $env:VITE_SUPABASE_ANON_KEY

# ถ้าไม่มี Environment Variables ให้ใช้ค่าจาก .env.local
if (-not $SUPABASE_URL -or -not $SUPABASE_ANON_KEY) {
    Write-Host "⚠️  ไม่พบ Environment Variables" -ForegroundColor Yellow
    Write-Host "กรุณาตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY" -ForegroundColor Yellow
    Write-Host "หรือแก้ไขไฟล์นี้ให้ใช้ค่าจาก .env.local" -ForegroundColor Yellow
    exit 1
}

# สร้าง URL
$url = "$SUPABASE_URL/functions/v1/daily-summary-worker"
if ($Date) {
    $url += "?date=$Date"
}

Write-Host "📊 Testing Daily Summary Worker..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

# เรียก API
try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "Content-Type" = "application/json"
    }
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

