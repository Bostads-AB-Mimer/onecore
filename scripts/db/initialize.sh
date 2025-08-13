#!/bin/bash

echo "Running database initialization..."

docker exec -i onecore-sql bash -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "$MSSQL_SA_PASSWORD" -C' <<-EOSQL
	CREATE DATABASE [tenants-leases];
	CREATE DATABASE [tenants-leases-test];
	CREATE DATABASE [property-info];
EOSQL

echo "Database initialization completed!"
