#!/bin/sh
set -eu

tag="${1:?usage: deploy.sh <image tag>}"

cd "$(dirname "$0")/../.."

export MOTORIX_TAG="$tag"
compose="docker compose -f compose.yaml -f compose.prod.yaml"

$compose pull auth-api business-api web
$compose up --detach --no-build --wait --wait-timeout 180 --remove-orphans
$compose ps

docker image prune --all --force --filter "label=org.opencontainers.image.source=https://github.com/Zerik-Official/Motorix"
