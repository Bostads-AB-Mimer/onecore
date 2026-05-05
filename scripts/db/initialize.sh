#!/bin/bash

# Waits for the local SQL Server container to be ready to accept connections.
# Each service creates its own database on startup via its db:ensure script.

set -e

CONTAINER="onecore-sql"

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
