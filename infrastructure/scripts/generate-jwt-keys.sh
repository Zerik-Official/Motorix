#!/bin/sh
set -eu

output_dir="${1:-secrets/jwt}"
private_key="$output_dir/private.pem"
public_key="$output_dir/public.pem"

if [ -f "$private_key" ] || [ -f "$public_key" ]; then
  echo "Keys already exist in '$output_dir'. Remove them first to rotate." >&2
  exit 1
fi

mkdir -p "$output_dir"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$private_key"
openssl rsa -in "$private_key" -pubout -out "$public_key"
chmod 600 "$private_key"
chmod 644 "$public_key"

echo "RS256 key pair generated:"
echo "  private (auth-api only): $private_key"
echo "  public  (business-api):  $public_key"
