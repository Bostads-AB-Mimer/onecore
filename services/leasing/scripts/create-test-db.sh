#!/bin/sh

docker compose -f ../../docker-compose.yaml up -d

# Vänta på att SQL Server är redo och skapa databasen
MAX_RETRIES=30
RETRY_DELAY=2
SYMLINK_CREATED=false

for i in $(seq 1 $MAX_RETRIES); do
  # Kontrollera om sqlcmd finns på förväntad plats (behöver vänta tills containern är redo)
  # Använder bash -c för att undvika MSYS path-konvertering på Windows
  if [ "$SYMLINK_CREATED" = false ]; then
    if docker exec onecore-sql bash -c "test -x /opt/mssql-tools/bin/sqlcmd" 2>/dev/null; then
      SYMLINK_CREATED=true
    elif docker exec onecore-sql bash -c "test -x /opt/mssql-tools18/bin/sqlcmd" 2>/dev/null; then
      echo "Skapar symlänk till sqlcmd från mssql-tools18..."
      docker exec onecore-sql bash -c "ln -s /opt/mssql-tools18 /opt/mssql-tools"
      SYMLINK_CREATED=true
    else
      echo "Attempt $i/$MAX_RETRIES: Container not ready, retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
      continue
    fi
  fi

  if docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -N -C -U sa -P "$MSSQL_SA_PASSWORD" -b -Q "IF DB_ID(N'\''tenants-leases-test'\'') IS NULL BEGIN CREATE DATABASE [tenants-leases-test]; END"'; then
    echo "Database ready"
    exit 0
  fi
  echo "Attempt $i/$MAX_RETRIES: SQL Server not ready, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done

echo "SQL Server did not become ready after $MAX_RETRIES attempts"
exit 1
