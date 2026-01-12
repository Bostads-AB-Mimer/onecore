#!/usr/bin/env -S pnpx ts-node

/**
 * Usage:
 *
 * ./scripts/import-test-contacts.ts <keycmobj> <keycmobj> ...
 */
import fs from 'node:fs/promises'
import sql from 'mssql'
import config from '../src/common/config'

const keycmobjs = process.argv.slice(2)

const { user, password, host, port, database } = config.xpandDatabase

/**
 * Mapping of table names to key column names.
 *
 * All tables are connected via `keycmobj`, but cmadr calls this
 * `keycode` we cannot have nice things.
 */
const TABLES: Record<string, string> = {
  cmctc: 'keycmobj',
  cmtel: 'keycmobj',
  cmeml: 'keycmobj',
  cmadr: 'keycode',
}

/**
 * Read the column order from the insert statement in `seed.sql`, so
 * it can be used to ensure that the data in the VALUES list is
 * written in the correct order.
 *
 * @param seedFileRows The seed file split into rows.
 * @param table The table name to get the column order for.
 *
 * @returns An array of column names in insert order.
 */
const columnOrder = (seedFileRows: string[], table: string) => {
  const begin = seedFileRows.findIndex(
    (l) => l.trim() === `-- BEGIN ${table} COLUMNS`
  )
  const end = seedFileRows.findIndex(
    (l) => l.trim() === `-- END ${table} COLUMNS`
  )

  if (begin === -1) {
    throw new Error(`"-- BEGIN ${table} COLUMNS" not found.`)
  }

  if (end === -1) {
    throw new Error(`"-- END ${table} COLUMNS" not found.`)
  }

  return seedFileRows
    .slice(begin + 1, end)
    .map((l) => l.trim().replaceAll(',', ''))
}

/**
 * Formats a row read from the DB into a string-representation
 * of a comma separated list
 * that can be added as VALUES in an INSERT statement.
 *
 * ex:
 * { column: 'value', numcolumn: 1 } => "('value', 1)"
 */
const toValues = (row: any, colOrder: string[]): string => {
  const values = colOrder
    .map((col) => row[col])
    .map((val) => {
      if (val === null || val === undefined) {
        return 'NULL'
      }
      if (typeof val === 'string') {
        return `'${val}'`
      }
      if (val instanceof Date) {
        return `'${val.toISOString()}'`
      }
      return val
    })
    .join(', ')
  return `(${values})`
}

/**
 * Splices rows into `seedFile` at the end of any existing rows
 * for `table` and adds a ',' to the preceding row, if any.
 *
 * @param seedFile The seed file split into rows.
 * @param table The table name to splice rows into.
 * @param valueRows The rows to splice in, formatted as VALUES.
 *                  (ie, the output of `toValues`).
 */
const spliceValues = (
  seedFile: string[],
  table: string,
  valueRows: string[]
) => {
  const position = seedFile.findIndex(
    (l) => l.trim() === `-- END OF ${table} ROWS`
  )
  seedFile.splice(position, 0, ...valueRows.map((r) => `  ${r}`))

  for (let i = position - 1; i < position + valueRows.length - 1; i++) {
    if (
      seedFile[i].trim() &&
      seedFile[i].trim() !== 'VALUES' &&
      !seedFile[i].trim().endsWith(',')
    ) {
      seedFile[i] = seedFile[i] + ','
    }
  }
}

const SEED_FILE_PATH = './.jest/sql/seed.sql'

const run = async () => {
  // 1. Load the existing seed.sql and split into lines
  const seedFile = (await fs.readFile(SEED_FILE_PATH, 'utf8')).split('\n')

  // 2. Read the column order for each table from seedFile.
  const columnOrderMap: Record<string, string[]> = {
    cmctc: columnOrder(seedFile, 'cmctc'),
    cmtel: columnOrder(seedFile, 'cmtel'),
    cmeml: columnOrder(seedFile, 'cmeml'),
    cmadr: columnOrder(seedFile, 'cmadr'),
  }

  // 3. Connect to the remote test or production Xpand DB.
  const pool = await sql.connect({
    server: host,
    port: Number(port),
    user,
    password,
    database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  })

  // 4. Read the rows for the input `keycmobj` IDs
  for (const table of Object.keys(TABLES)) {
    console.log(`Importing "${table}" rows...`)
    const resultset = await pool.query(
      `SELECT * FROM ${table} WHERE ${TABLES[table]} IN (${keycmobjs.map((o) => `'${o}'`).join(', ')})`
    )

    const valueRows = resultset.recordset.map((row) =>
      toValues(row, columnOrderMap[table])
    )

    spliceValues(seedFile, table, valueRows)

    console.log(`- Added ${valueRows.length} rows.`)
  }

  // 5. Write the modified seed file lines back to disk
  await fs.writeFile(SEED_FILE_PATH, seedFile.join('\n'), 'utf8')

  console.log('Wrote result to', SEED_FILE_PATH)

  // 6. The End, happily ever after, etc, etc
  await pool.close()
}

run()
  .then(() => {
    console.log('Done!')
  })
  .catch((err) => {
    console.error('TERROR! ERROR! RUN! ALIEN INVASION! RUN! RUN!')
    console.log(err)
  })
