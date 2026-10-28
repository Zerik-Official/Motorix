#!/bin/sh
set -eu

create_service_database() {
  db_name="$1"
  db_user="$2"
  db_password="$3"

  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -v db_name="$db_name" \
    -v db_user="$db_user" \
    -v db_password="$db_password" <<'EOSQL'
CREATE ROLE :"db_user" LOGIN PASSWORD :'db_password';
CREATE DATABASE :"db_name" OWNER :"db_user";
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO :"db_user";
EOSQL

  echo "Database '$db_name' created and owned by '$db_user'"
}

create_service_database "$AUTH_DB_NAME" "$AUTH_DB_USER" "$AUTH_DB_PASSWORD"
create_service_database "$BUSINESS_DB_NAME" "$BUSINESS_DB_USER" "$BUSINESS_DB_PASSWORD"
