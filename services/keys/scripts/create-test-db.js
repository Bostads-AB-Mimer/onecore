#!/usr/bin/env node
/**
 * Cross-platform script to create test database
 * Works on both Windows and Mac/Linux
 */

const { execSync } = require('child_process')

const DB_NAME = 'keys-management-test'
const PASSWORD = 's3cr3t_p455w0rd' // Same as in .env.test and docker-compose
const MAX_RETRIES = 30
const RETRY_DELAY_MS = 2000

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

const sql = `IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE [${DB_NAME}]`
const cmd = `docker exec onecore-sql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "${PASSWORD}" -Q "${sql}"`

for (let i = 1; i <= MAX_RETRIES; i++) {
  try {
    execSync(cmd, { stdio: 'inherit' })
    console.log(`Test database '${DB_NAME}' ready`)
    process.exit(0)
  } catch (error) {
    if (i === MAX_RETRIES) {
      console.error(
        `SQL Server did not become ready after ${MAX_RETRIES} attempts`
      )
      process.exit(1)
    }
    console.log(
      `Attempt ${i}/${MAX_RETRIES}: SQL Server not ready, retrying in ${RETRY_DELAY_MS / 1000}s...`
    )
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAY_MS)
  }
}
