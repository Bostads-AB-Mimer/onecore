#!/usr/bin/env node
/**
 * Cross-platform script to drop test database
 * Works on both Windows and Mac/Linux
 */

const { execSync } = require('child_process')

const DB_NAME = 'keys-management-test'
const PASSWORD = 's3cr3t_p455w0rd' // Same as in .env.test and docker-compose

console.log(`Dropping test database: ${DB_NAME}`)
try {
  const sql = `IF DB_ID('${DB_NAME}') IS NOT NULL DROP DATABASE [${DB_NAME}]`

  execSync(
    `docker exec onecore-sql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${PASSWORD}" -Q "${sql}"`,
    { stdio: 'inherit' }
  )

  console.log(`✓ Test database '${DB_NAME}' dropped`)
} catch (error) {
  console.error('Failed to drop test database')
  process.exit(1)
}
