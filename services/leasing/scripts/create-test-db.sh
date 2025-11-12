#!/bin/sh

docker compose -f ../../docker-compose.yaml up -d

# Kontrollera om sqlcmd finns på förväntad plats
if ! docker exec onecore-sql test -x /opt/mssql-tools/bin/sqlcmd; then
  # Om inte, kolla om den finns under mssql-tools18
  if docker exec onecore-sql test -x /opt/mssql-tools18/bin/sqlcmd; then
    echo "Skapar symlänk till sqlcmd från mssql-tools18..."
    docker exec onecore-sql ln -s /opt/mssql-tools18 /opt/mssql-tools
  else
    echo "sqlcmd hittades inte i containern!"
    exit 1
  fi
fi

# Kör sqlcmd som vanligt
docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -N -C -U sa -P "$MSSQL_SA_PASSWORD" -b -Q "IF DB_ID(N'\''tenants-leases-test'\'') IS NULL BEGIN CREATE DATABASE [tenants-leases-test]; END"'