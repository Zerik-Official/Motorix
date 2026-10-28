param(
    [string]$OutputDir = "secrets/jwt"
)

$ErrorActionPreference = "Stop"

$privateKey = Join-Path $OutputDir "private.pem"
$publicKey = Join-Path $OutputDir "public.pem"

if ((Test-Path $privateKey) -or (Test-Path $publicKey)) {
    Write-Error "Keys already exist in '$OutputDir'. Remove them first to rotate."
    exit 1
}

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if ($openssl) {
    $opensslPath = $openssl.Source
} else {
    $gitOpenssl = Join-Path $env:ProgramFiles "Git\usr\bin\openssl.exe"
    if (-not (Test-Path $gitOpenssl)) {
        Write-Error "OpenSSL was not found. Install Git for Windows or OpenSSL and try again."
        exit 1
    }
    $opensslPath = $gitOpenssl
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

& $opensslPath genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out $privateKey
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $opensslPath rsa -in $privateKey -pubout -out $publicKey
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $privateKey /inheritance:r /grant:r "${currentUser}:(R,W)" | Out-Null

Write-Host "RS256 key pair generated:"
Write-Host "  private (auth-api only): $privateKey"
Write-Host "  public  (business-api):  $publicKey"
