#!/bin/sh

# Remove existing rows
docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d contacts-xpand-test' < ./.jest/sql/truncate.sql

# Run seed INSERT statements
echo "Seeding test data..."
docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d contacts-xpand-test' < ./.jest/sql/seed.sql
