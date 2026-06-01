# ==============================================================
# Construction Manager v3 デプロイスクリプト (PowerShell版)
# 実行: PowerShell で .\deploy.ps1
# ==============================================================

$SSH_KEY   = "C:\tmp\new_key.pem"
$SERVER    = "root@116.80.96.175"
$REMOTE    = "/root/cmv3"
$DOMAIN    = "cmv3.fact-ally.com"
$SRC       = "G:\マイドライブ\antigravity\Construction_Manager_v3"

# .env から GEMINI_API_KEY を取得
$GEMINI_API_KEY = (Get-Content "$SRC\.env" -ErrorAction SilentlyContinue |
    Where-Object { $_ -match '^GEMINI_API_KEY=' } |
    ForEach-Object { ($_ -split '=', 2)[1] }) -join ''

# シークレット生成
Add-Type -AssemblyName System.Security
$PG_PASS    = -join ((1..16) | ForEach-Object { '{0:x2}' -f [System.Security.Cryptography.RandomNumberGenerator]::GetInt32(0, 256) })
$REDIS_PASS = -join ((1..16) | ForEach-Object { '{0:x2}' -f [System.Security.Cryptography.RandomNumberGenerator]::GetInt32(0, 256) })
$JWT_SECRET = -join ((1..32) | ForEach-Object { '{0:x2}' -f [System.Security.Cryptography.RandomNumberGenerator]::GetInt32(0, 256) })

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Construction Manager v3  デプロイ開始" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$SSH_OPTS = @("-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30", "-i", $SSH_KEY)

# ── [1/6] ファイルを zip 圧縮してサーバーへ転送 ────────────────
Write-Host "`n[1/6] ファイルを圧縮してサーバーへ転送中..." -ForegroundColor Yellow
$TMP_ZIP = "C:\tmp\cmv3_deploy.zip"
if (Test-Path $TMP_ZIP) { Remove-Item $TMP_ZIP }

# 除外リスト
$exclude = @('.git','node_modules','__pycache__','.next','.venv','*.egg-info','pgdata','.env','backend\.env','deploy.ps1','deploy.sh')

# ファイル収集（除外パターンを適用）
$files = Get-ChildItem -Path $SRC -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($SRC.Length + 1)
    $skip = $false
    foreach ($ex in $exclude) {
        if ($rel -like "*$ex*") { $skip = $true; break }
    }
    -not $skip
}
Compress-Archive -Path $files.FullName -DestinationPath $TMP_ZIP -CompressionLevel Optimal 2>$null

# zip転送
scp @SSH_OPTS $TMP_ZIP "${SERVER}:${REMOTE}/cmv3_deploy.zip"

# サーバーで展開
ssh @SSH_OPTS $SERVER "mkdir -p $REMOTE && cd $REMOTE && unzip -o cmv3_deploy.zip -d . > /dev/null 2>&1; rm cmv3_deploy.zip"
Write-Host "  完了" -ForegroundColor Green

# ── [2/6] .env 作成 ─────────────────────────────────────────────
Write-Host "`n[2/6] サーバーに .env を作成中..." -ForegroundColor Yellow
$envContent = @"
POSTGRES_DB=cmv3
POSTGRES_USER=cmv3user
POSTGRES_PASSWORD=$PG_PASS
DATABASE_URL=postgresql+asyncpg://cmv3user:$PG_PASS@postgres:5432/cmv3
REDIS_PASSWORD=$REDIS_PASS
REDIS_URL=redis://:$REDIS_PASS@cmv3-redis:6379/0
GEMINI_API_KEY=$GEMINI_API_KEY
JWT_SECRET=$JWT_SECRET
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=https://$DOMAIN
NEXT_PUBLIC_API_URL=https://$DOMAIN
APP_ENV=production
LOG_LEVEL=INFO
"@
$envContent | ssh @SSH_OPTS $SERVER "cat > $REMOTE/.env"
Write-Host "  完了" -ForegroundColor Green

# ── [3/6] DB 作成 ────────────────────────────────────────────────
Write-Host "`n[3/6] postgres コンテナに cmv3 DB とユーザーを作成中..." -ForegroundColor Yellow
ssh @SSH_OPTS $SERVER "docker exec postgres psql -U postgres -c `"CREATE USER cmv3user WITH PASSWORD '$PG_PASS';`" 2>/dev/null; true"
ssh @SSH_OPTS $SERVER "docker exec postgres psql -U postgres -c `"ALTER USER cmv3user WITH PASSWORD '$PG_PASS';`" 2>/dev/null; true"
ssh @SSH_OPTS $SERVER "docker exec postgres psql -U postgres -c `"CREATE DATABASE cmv3 OWNER cmv3user;`" 2>/dev/null; true"
ssh @SSH_OPTS $SERVER "docker exec postgres psql -U postgres -c `"GRANT ALL PRIVILEGES ON DATABASE cmv3 TO cmv3user;`" 2>/dev/null; true"
Write-Host "  完了" -ForegroundColor Green

# ── [4/6] Docker Compose ビルド＆起動 ───────────────────────────
Write-Host "`n[4/6] Docker イメージをビルド中（5〜10分）..." -ForegroundColor Yellow
ssh @SSH_OPTS $SERVER "cd $REMOTE && docker compose -f docker-compose.prod.yml up -d --build 2>&1"
Write-Host "  完了" -ForegroundColor Green

# ── [5/6] postgres をネットワーク接続 → マイグレーション ─────────
Write-Host "`n[5/6] postgres をネットワーク接続してマイグレーション実行中..." -ForegroundColor Yellow
ssh @SSH_OPTS $SERVER "docker network connect cmv3-prod-network postgres 2>/dev/null; true"
ssh @SSH_OPTS $SERVER "docker restart cmv3-api && sleep 12 && docker logs cmv3-api --tail=20"
Write-Host "  完了" -ForegroundColor Green

# ── [6/6] Nginx 設定 ─────────────────────────────────────────────
Write-Host "`n[6/6] Nginx 設定を追加中..." -ForegroundColor Yellow
$nginxConf = @"
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass         http://127.0.0.1:8005;
        proxy_set_header   Host              `$host;
        proxy_set_header   X-Real-IP         `$remote_addr;
        proxy_set_header   X-Forwarded-For   `$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto `$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }
}
"@
$nginxConf | ssh @SSH_OPTS $SERVER "cat > /etc/nginx/sites-available/cmv3 && ln -sf /etc/nginx/sites-available/cmv3 /etc/nginx/sites-enabled/cmv3 && nginx -t && systemctl reload nginx"
Write-Host "  完了" -ForegroundColor Green

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host " デプロイ完了！" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "【次のステップ】"
Write-Host "1. ムームードメインで DNS を追加："
Write-Host "   サブドメイン: cmv3 / 種別: A / 内容: 116.80.96.175"
Write-Host ""
Write-Host "2. DNS 反映後（最大2時間）に SSL 取得："
Write-Host "   ssh -i C:\tmp\new_key.pem root@116.80.96.175 'certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m hisa1975@gmail.com'"
Write-Host ""
Write-Host "3. アクセス確認: https://$DOMAIN"
Write-Host ""
Write-Host "【生成されたシークレット（控えてください）】" -ForegroundColor Yellow
Write-Host "  POSTGRES_PASSWORD: $PG_PASS"
Write-Host "  REDIS_PASSWORD:    $REDIS_PASS"
Write-Host "  JWT_SECRET:        $JWT_SECRET"
