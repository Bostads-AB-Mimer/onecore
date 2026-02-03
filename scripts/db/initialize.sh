#!/bin/bash

echo "Running database initialization..."

# Find sqlcmd location (supports both mssql-tools and mssql-tools18)
SQLCMD_PATH=$(docker exec onecore-sql bash -c "command -v sqlcmd || find /opt -name sqlcmd -type f 2>/dev/null | head -1")

if [ -z "$SQLCMD_PATH" ]; then
    echo "ERROR: sqlcmd not found in container"
    exit 1
fi

echo "Using sqlcmd at: $SQLCMD_PATH"

docker exec -i onecore-sql bash -c "$SQLCMD_PATH -S localhost -U SA -P \"s3cr3t_p455w0rd\" -C" <<-EOSQL
    CREATE DATABASE [tenants-leases];
    CREATE DATABASE [tenants-leases-test];
    CREATE DATABASE [property-info];
    CREATE DATABASE [economy];
    CREATE DATABASE [keys-management];
EOSQL

echo "Database initialization completed!"
