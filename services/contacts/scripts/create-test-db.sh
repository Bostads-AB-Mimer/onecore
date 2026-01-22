#!/bin/sh

docker compose -f ../../docker-compose.yaml up -d

# Check for presence of sqlcmd in container
if ! docker exec onecore-sql test -x /opt/mssql-tools/bin/sqlcmd; then
  # If not at the standard location, check `mssql-tools18`
  if docker exec onecore-sql test -x /opt/mssql-tools18/bin/sqlcmd; then
    echo "Creating symlink for /opt/mssql-tools18 => /opt/mssql-tools"
    docker exec onecore-sql ln -s /opt/mssql-tools18 /opt/mssql-tools
  else
    echo "sqlcmd could not be found."
    exit 1
  fi
fi

# Create the database
echo "Creating database..."
docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -N -C -U sa -P "$MSSQL_SA_PASSWORD" -b -Q "IF DB_ID(N'\''contacts-xpand-test'\'') IS NULL BEGIN CREATE DATABASE [contacts-xpand-test]; END"'

# Run CREATE TABLE statements
echo "Creating tables..."
docker exec -i onecore-sql sh -lc '/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d contacts-xpand-test' < ./.jest/sql/create.sql

