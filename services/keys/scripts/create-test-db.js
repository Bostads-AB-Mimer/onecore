#!/usr/bin/env node
/**
 * Cross-platform script to create test database
 * Works on both Windows and Mac/Linux
 */

const { execSync } = require('child_process')

const DB_NAME = 'keys-management-test'
const PASSWORD = 's3cr3t_p455w0rd' // Same as in .env.test and docker-compose

console.log('Starting Docker containers...')
try {
  execSync('docker compose -f ../../docker-compose.yaml up -d', {
    stdio: 'inherit',
  })
} catch (error) {
  console.error('Failed to start Docker containers')
  process.exit(1)
}

console.log(`Creating test database: ${DB_NAME}`)
try {
  // Simple SQL command that works cross-platform
  const sql = `IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE [${DB_NAME}]`

  execSync(
    `docker exec onecore-sql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${PASSWORD}" -Q "${sql}"`,
    { stdio: 'inherit' }
  )

  console.log(`✓ Test database '${DB_NAME}' ready`)
} catch (error) {
  console.error('Failed to create test database')
  process.exit(1)
}
