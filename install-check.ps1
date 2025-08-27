# 安裝測試腳本

Write-Host "=== noVNC 文字貼上工具安裝檢查 ===" -ForegroundColor Green

# 檢查必要檔案
$requiredFiles = @(
    "manifest.json",
    "popup.html", 
    "popup.js",
    "content.js",
    "background.js",
    "styles.css",
    "README.md"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file (遺失)" -ForegroundColor Red
        $missingFiles += $file
    }
}

Write-Host "`n=== 安裝步驟 ===" -ForegroundColor Blue

if ($missingFiles.Count -eq 0) {
    Write-Host "所有必要檔案都已就緒！" -ForegroundColor Green
    Write-Host "`n請按照以下步驟安裝：" -ForegroundColor Yellow
    Write-Host "1. 開啟 Chrome 瀏覽器"
    Write-Host "2. 進入 chrome://extensions/"
    Write-Host "3. 開啟右上角的「開發人員模式」"
    Write-Host "4. 點擊「載入未封裝項目」"
    Write-Host "5. 選擇此資料夾：$(Get-Location)"
    Write-Host "6. 插件安裝完成！"
    
    Write-Host "`n=== 使用說明 ===" -ForegroundColor Blue
    Write-Host "1. 前往任何 noVNC 網頁"
    Write-Host "2. 點擊瀏覽器工具列上的插件圖示"
    Write-Host "3. 輸入要貼上的文字"
    Write-Host "4. 調整輸入延遲（建議 50-200 毫秒）"
    Write-Host "5. 點擊「開始貼上」"
    
} else {
    Write-Host "發現遺失檔案，請先完成檔案建立。" -ForegroundColor Red
    Write-Host "遺失檔案：" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
}

Write-Host "`n=== 測試建議 ===" -ForegroundColor Blue
Write-Host "建議使用以下網站測試："
Write-Host "- 任何 noVNC 實例"
Write-Host "- online vnc viewer 網站"
Write-Host "- 本地 noVNC 服務"

Write-Host "`n按任意鍵結束..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
