#!/bin/bash

echo "Running database initialization..."

docker exec -i onecore-sql bash -c "/opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P \"s3cr3t_p455w0rd\" -C" <<-EOSQL
    CREATE DATABASE [tenants-leases];
    CREATE DATABASE [tenants-leases-test];
    CREATE DATABASE [property-info];
    CREATE DATABASE [economy];
EOSQL

echo "Database initialization completed!"
