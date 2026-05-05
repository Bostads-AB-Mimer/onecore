#!/bin/bash

set -e

CONTAINER="onecore-sql"

echo "Running database initialization..."

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Container '${CONTAINER}' is not running."
  echo "       Start it first with: docker compose up -d"
  exit 1
fi

SQLCMD_PATH=$(docker exec "$CONTAINER" bash -c "command -v sqlcmd || find /opt -name sqlcmd -type f 2>/dev/null | head -1")

if [ -z "$SQLCMD_PATH" ]; then
  echo "ERROR: sqlcmd not found in container"
  exit 1
fi

echo "Using sqlcmd at: $SQLCMD_PATH"

echo "Waiting for SQL Server to be ready..."
retries=30
until docker exec "$CONTAINER" bash -c "$SQLCMD_PATH -S localhost -U SA -P \"\$MSSQL_SA_PASSWORD\" -C -Q 'SELECT 1' > /dev/null 2>&1"; do
  retries=$((retries - 1))
  if [ "$retries" -le 0 ]; then
    echo "ERROR: SQL Server did not become ready in time."
    exit 1
  fi
  echo "  Not ready yet, retrying in 2 seconds... ($retries retries left)"
  sleep 2
done
echo "SQL Server is ready."

echo "Creating databases..."
docker exec -i "$CONTAINER" bash -c "$SQLCMD_PATH -S localhost -U SA -P \"\$MSSQL_SA_PASSWORD\" -C" <<-EOSQL
  IF DB_ID(N'tenants-leases')        IS NULL CREATE DATABASE [tenants-leases];
  IF DB_ID(N'tenants-leases-test')   IS NULL CREATE DATABASE [tenants-leases-test];
  IF DB_ID(N'property-info')         IS NULL CREATE DATABASE [property-info];
  IF DB_ID(N'economy')               IS NULL CREATE DATABASE [economy];
  IF DB_ID(N'inspection')            IS NULL CREATE DATABASE [inspection];
  IF DB_ID(N'keys-management')       IS NULL CREATE DATABASE [keys-management];
EOSQL

echo "Database initialization completed!"
