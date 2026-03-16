# =============================================================================
#  Lumen+ -- MVP Endpoint Validation
#  Uso: .\mvp_check.ps1
#  Requer: backend rodando em http://127.0.0.1:8000
# =============================================================================

$BASE  = "http://127.0.0.1:8000"
$EMAIL = "mvp-check@lumen.dev"
$PASS  = "devpass"
$NAME  = "MVP Check"

$script:token  = $null
$script:passed = 0
$script:failed = 0

# ── helpers ──────────────────────────────────────────────────────────────────

function OK($label) {
    Write-Host "  [OK]  $label" -ForegroundColor Green
    $script:passed++
}

function FAIL($label, $msg) {
    Write-Host "  [FAIL] $label" -ForegroundColor Red
    Write-Host "         $msg"   -ForegroundColor DarkRed
    $script:failed++
}

function Auth { @{ Authorization = "Bearer $script:token" } }

function JSON($o) { $o | ConvertTo-Json -Compress -Depth 5 }

function HasFields($obj, [string[]]$fields) {
    foreach ($f in $fields) {
        if ($obj.PSObject.Properties.Name -notcontains $f) {
            throw "campo '$f' ausente na resposta"
        }
    }
}

function StatusCode($ex) {
    try { return [int]$ex.Exception.Response.StatusCode.value__ }
    catch { return 0 }
}

# ── cabecalho ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Lumen+ -- MVP Endpoint Validation ($BASE)"        -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. AUTH: register ou login ────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Method Post -Uri "$BASE/auth/register" `
         -ContentType "application/json" `
         -Body (JSON @{ email=$EMAIL; password=$PASS; full_name=$NAME })
    $script:token = $r.access_token
    OK "POST /auth/register -> token obtido"
} catch {
    $code = StatusCode $_
    if ($code -eq 409 -or $code -eq 400) {
        try {
            $r = Invoke-RestMethod -Method Post -Uri "$BASE/auth/login" `
                 -ContentType "application/json" `
                 -Body (JSON @{ email=$EMAIL; password=$PASS })
            $script:token = $r.access_token
            OK "POST /auth/login -> token obtido (usuario ja existia, login fallback ok)"
        } catch {
            FAIL "POST /auth/login (fallback apos register)" $_.Exception.Message
        }
    } else {
        FAIL "POST /auth/register" "HTTP $code -- $($_.Exception.Message)"
    }
}

if (-not $script:token) {
    Write-Host ""
    Write-Host "  [ABORT] Sem token. Encerrando." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ── 2. GET /auth/me ───────────────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/auth/me" -Headers (Auth)
    HasFields $r @("user_id","consents","profile_status","memberships","pending_invites")
    $uid = $r.user_id.ToString().Substring(0,8)
    OK "GET  /auth/me -> user=${uid}...  profile=$($r.profile_status)  consents=$($r.consents.status)"
} catch { FAIL "GET /auth/me" $_.Exception.Message }

# ── 2.5. POST /dev/seed (garante dados base: catalogs, roles, legal) ──────────

try {
    $null = Invoke-RestMethod -Method Post -Uri "$BASE/dev/seed" -Headers (Auth)
    OK "POST /dev/seed -> dados base garantidos"
} catch { FAIL "POST /dev/seed" $_.Exception.Message }

# ── 3. GET /profile/catalogs (publico, sem token) ─────────────────────────────

$script:lifeStateId          = $null
$script:maritalStatusId      = $null
$script:vocationalRealityId  = $null

try {
    $catalogs = Invoke-RestMethod -Uri "$BASE/profile/catalogs"
    $count = if ($catalogs) { @($catalogs).Count } else { 0 }
    OK "GET  /profile/catalogs (publico) -> $count catalogo(s)"

    foreach ($cat in $catalogs) {
        $firstItem = if ($cat.items -and @($cat.items).Count -gt 0) { @($cat.items)[0] } else { $null }
        if (-not $firstItem) { continue }
        switch ($cat.code) {
            "LIFE_STATE"          { $script:lifeStateId         = $firstItem.id }
            "MARITAL_STATUS"      { $script:maritalStatusId     = $firstItem.id }
            "VOCATIONAL_REALITY"  { $script:vocationalRealityId = $firstItem.id }
        }
    }
} catch { FAIL "GET /profile/catalogs" $_.Exception.Message }

# ── 4. PUT /profile ───────────────────────────────────────────────────────────

try {
    $body = @{
        full_name  = $NAME
        cpf        = "529.982.247-25"
        rg         = "1234567"
        birth_date = "1990-01-01"
        phone_e164 = "+5511999990001"
        city       = "Sao Paulo"
        state      = "SP"
    }
    if ($script:lifeStateId)         { $body.life_state_item_id         = $script:lifeStateId }
    if ($script:maritalStatusId)     { $body.marital_status_item_id     = $script:maritalStatusId }
    if ($script:vocationalRealityId) { $body.vocational_reality_item_id = $script:vocationalRealityId }

    $r = Invoke-RestMethod -Method Put -Uri "$BASE/profile" -Headers (Auth) `
         -ContentType "application/json" `
         -Body (JSON $body)
    HasFields $r @("user_id","status")
    OK "PUT  /profile -> status=$($r.status)"
} catch { FAIL "PUT /profile" $_.Exception.Message }

# ── 5. GET /profile ───────────────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/profile" -Headers (Auth)
    HasFields $r @("user_id","status")
    OK "GET  /profile -> status=$($r.status)"
} catch { FAIL "GET /profile" $_.Exception.Message }

# ── 6. GET /legal/latest ──────────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/legal/latest" -Headers (Auth)
    HasFields $r @("terms","privacy")
    $tv = if ($r.terms)   { $r.terms.version }   else { "null (sem seed)" }
    $pv = if ($r.privacy) { $r.privacy.version } else { "null (sem seed)" }
    OK "GET  /legal/latest -> terms=$tv  privacy=$pv"
} catch { FAIL "GET /legal/latest" $_.Exception.Message }

# ── 7. GET /org/tree ─────────────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/org/tree" -Headers (Auth)
    HasFields $r @("root")
    $rn = if ($r.root) { $r.root.name } else { "null (sem org criada)" }
    OK "GET  /org/tree -> root=$rn"
} catch { FAIL "GET /org/tree" $_.Exception.Message }

# ── 8. GET /org/my/memberships ───────────────────────────────────────────────

try {
    $r   = Invoke-RestMethod -Uri "$BASE/org/my/memberships" -Headers (Auth)
    $cnt = if ($r) { @($r).Count } else { 0 }
    OK "GET  /org/my/memberships -> $cnt membership(s)"
} catch { FAIL "GET /org/my/memberships" $_.Exception.Message }

# ── 9. GET /org/my/invites ───────────────────────────────────────────────────

try {
    $r   = Invoke-RestMethod -Uri "$BASE/org/my/invites" -Headers (Auth)
    $cnt = if ($r) { @($r).Count } else { 0 }
    OK "GET  /org/my/invites -> $cnt convite(s)"
} catch { FAIL "GET /org/my/invites" $_.Exception.Message }

# ── 10. GET /inbox ────────────────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/inbox" -Headers (Auth)
    HasFields $r @("messages","total","unread_count")
    OK "GET  /inbox -> total=$($r.total)  unread=$($r.unread_count)"
} catch { FAIL "GET /inbox" $_.Exception.Message }

# ── 11. GET /inbox/unread ─────────────────────────────────────────────────────

try {
    $r   = Invoke-RestMethod -Uri "$BASE/inbox/unread" -Headers (Auth)
    $cnt = if ($r) { @($r).Count } else { 0 }
    OK "GET  /inbox/unread -> $cnt mensagem(ns)"
} catch { FAIL "GET /inbox/unread" $_.Exception.Message }

# ── 12. GET /inbox/permissions ────────────────────────────────────────────────

try {
    $r = Invoke-RestMethod -Uri "$BASE/inbox/permissions" -Headers (Auth)
    HasFields $r @("permissions","has_admin_access")
    OK "GET  /inbox/permissions -> admin=$($r.has_admin_access)"
} catch { FAIL "GET /inbox/permissions" $_.Exception.Message }

# ── 13. POST /verify/phone/start ─────────────────────────────────────────────
# 200 = OTP enviado | 503 = desabilitado nas settings | 400 = phone nao bate
# Qualquer outro status = falha real

try {
    $null = Invoke-RestMethod -Method Post -Uri "$BASE/verify/phone/start" `
            -Headers (Auth) -ContentType "application/json" `
            -Body (JSON @{ phone_e164 = "+5511999990001"; channel = "SMS" })
    OK "POST /verify/phone/start -> OTP enviado"
} catch {
    $code = StatusCode $_
    if ($code -eq 503) {
        OK "POST /verify/phone/start -> 503 (verificacao desabilitada nas settings, aceitavel em DEV)"
    } elseif ($code -eq 400) {
        OK "POST /verify/phone/start -> 400 (phone nao corresponde ao perfil, endpoint funcional)"
    } else {
        FAIL "POST /verify/phone/start" "HTTP $code inesperado"
    }
}

# ── resultado final ───────────────────────────────────────────────────────────

$total = $script:passed + $script:failed

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan

if ($script:failed -eq 0) {
    Write-Host "  MVP PRONTO -- $($script:passed)/$total checks passaram" -ForegroundColor Green
} else {
    Write-Host "  $($script:failed) FALHA(S) -- $($script:passed) OK de $total" -ForegroundColor Red
}

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
