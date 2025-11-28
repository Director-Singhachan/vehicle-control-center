# PowerShell script สำหรับทดสอบ daily-summary-worker
# Usage: .\scripts\test-daily-summary.ps1 [date]
# Example: .\scripts\test-daily-summary.ps1 2025-01-15

param(
    [string]$Date = ""
)

# ตั้งค่า URL และ Key
$SUPABASE_URL = "https://oqacrkcfpdhcntbldgrm.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xYWNya2NmcGRoY250YmxkZ3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNzY4MDAsImV4cCI6MjA0OTg1MjgwMH0.YourAnonKey"

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

