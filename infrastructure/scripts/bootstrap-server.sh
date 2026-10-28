#!/bin/sh
set -eu

public_url="${1:?usage: bootstrap-server.sh <public url> <root email>}"
root_email="${2:?usage: bootstrap-server.sh <public url> <root email>}"

cd "$(dirname "$0")/../.."

secret() {
  openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-40
}

write_once() {
  if [ -f "$1" ]; then
    echo "Kept $1, it already exists"
    return 1
  fi
  umask 077
  cat > "$1"
  echo "Wrote $1"
}

write_once .env <<ENV || true
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(secret)
POSTGRES_DB=postgres

AUTH_DB_NAME=auth_db
AUTH_DB_USER=auth_service
AUTH_DB_PASSWORD=$(secret)

BUSINESS_DB_NAME=business_db
BUSINESS_DB_USER=business_service
BUSINESS_DB_PASSWORD=$(secret)

PUBLIC_URL=$public_url
WEB_TURNSTILE_SITE_KEY=
ENV

write_once services/auth-api/.env <<ENV || true
APP_NAME=auth-api
JWT_ISSUER=motorix-auth-api
JWT_AUDIENCE=motorix-business-api
JWT_EXPIRES_IN_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=43200
DB_POOL_SIZE=5
MAX_PAGE_SIZE=100

TURNSTILE_SECRET_KEY=
TURNSTILE_VERIFY_URL=https://challenges.cloudflare.com/turnstile/v0/siteverify

RATE_LIMIT_WINDOW_SECONDS=900
RATE_LIMIT_MAX=300
LOGIN_RATE_LIMIT_WINDOW_SECONDS=900
LOGIN_RATE_LIMIT_MAX=10

ROOT_EMAIL=$root_email
ROOT_PASSWORD=$(secret)
ROOT_FULL_NAME=Root

LOG_LEVEL=INFO
LOG_VERBOSITY=1
ENV

write_once services/business-api/.env <<ENV || true
APP_NAME=business-api
JWT_ISSUER=motorix-auth-api
JWT_AUDIENCE=motorix-business-api
JWT_LEEWAY_SECONDS=10
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
MAX_PAGE_SIZE=100

RATE_LIMIT_WINDOW_SECONDS=900
RATE_LIMIT_MAX=300

LOG_LEVEL=INFO
LOG_VERBOSITY=1
ENV

if [ -f secrets/jwt/private.pem ]; then
  echo "Kept secrets/jwt, the key pair already exists"
else
  sh infrastructure/scripts/generate-jwt-keys.sh secrets/jwt
fi

echo "Set TURNSTILE_SECRET_KEY in services/auth-api/.env before the first deploy."
echo "ROOT_PASSWORD in services/auth-api/.env is only the first password of root: change it from the app."
