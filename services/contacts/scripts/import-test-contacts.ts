#!/usr/bin/env -S node -r ts-node/register -r tsconfig-paths/register
// -*- mode: typescript-ts; -*-

/**
 * Usage:
 * ./scripts/import-test-contacts.ts <contactCode> <contactCode> ...
 * ./scripts/import-test-contacts.ts -f <filename>
 *
 * Pass flag -c to remove all current rows from seed.sql
 */
import fs from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { connect } from './db'
import {
  sanitizeAddress,
  sanitizeBirthDate,
  sanitizeEmail,
  sanitizeFirstName,
  sanitizeLastName,
  sanitizeName,
  sanitizePersOrgNr,
  sanitizePhoneNumber,
} from './sanitize'

const args = process.argv.slice(2)

const readInputFile = (filePath: string) => {
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf8')
      .split('\n')
      .map((r) => r.trim().split(' ')[0])
      .filter(Boolean)
      .filter((l) => !l.startsWith('#'))
  }
  return []
}

const inputFile = args.includes('-f') ? args[args.indexOf('-f') + 1] : null
const cleanSeedFile = args.includes('-c')

const contactCodes = inputFile
  ? readInputFile(args[1])
  : args.filter((a) => !a.startsWith('-'))

if (contactCodes.length === 0 && !cleanSeedFile) {
  console.log('Usage:')
  console.log(
    './scripts/import-test-contacts.ts <contactCode> <contactCode> ...'
  )
  console.log('./scripts/import-test-contacts.ts -f <filename>')
}

type TableName = 'cmctc' | 'cmtel' | 'cmeml' | 'cmadr'

/**
 * Mapping of table names to key column names.
 *
 * All tables are connected via `keycmobj`, but cmadr calls this
 * `keycode` we cannot have nice things.
 */
const TABLES: Record<TableName, string> = {
  cmctc: 'keycmobj',
  cmtel: 'keycmobj',
  cmeml: 'keycmobj',
  cmadr: 'keycode',
}

const sanitizeColumns = {
  cmctc: (row: any) => {
    row.cmctcben = sanitizeName(row.cmctcben)
    row.fnamn = sanitizeFirstName(row.fnamn)
    row.enamn = sanitizeLastName(row.enamn)
    row.birthdate = sanitizeBirthDate(row.birthdate)
    row.persorgnr = sanitizePersOrgNr(row.persorgnr)
    return row
  },
  cmadr: (row: any) => {
    return {
      ...row,
      ...sanitizeAddress(row),
    }
  },
  cmeml: (row: any) => {
    row.cmemlben = sanitizeEmail(row.cmemlben)
    return row
  },
  cmtel: (row: any) => {
    row.cmtelben = sanitizePhoneNumber(row.cmtelben)
    return row
  },
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

const beginRowsIndex = (seedFile: string[], table: string) => {
  return seedFile.findIndex((l) => l.trim() === `-- BEGIN ${table} ROWS`)
}

const endRowsIndex = (seedFile: string[], table: string) => {
  return seedFile.findIndex((l) => l.trim() === `-- END ${table} ROWS`)
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
  const position = endRowsIndex(seedFile, table)
  seedFile.splice(position, 0, ...valueRows.map((r) => `  ${r}`))

  for (let i = position - 1; i < position + valueRows.length - 1; i++) {
    if (
      seedFile[i].trim() &&
      seedFile[i].trim() !== 'VALUES' &&
      !seedFile[i].trim().startsWith('-- BEGIN ') &&
      !seedFile[i].trim().endsWith(',')
    ) {
      seedFile[i] = seedFile[i] + ','
    }
  }
}

const removeFileValues = (seedFile: string[]) => {
  Object.keys(TABLES).forEach((table) => {
    const beginIndex = beginRowsIndex(seedFile, table)
    const endIndex = endRowsIndex(seedFile, table)

    seedFile.splice(beginIndex + 1, endIndex - beginIndex - 1)
  })
}

const SEED_FILE_PATH = './.jest/sql/seed.sql'

const run = async () => {
  // 1. Load the existing seed.sql, split into lines and clean if requested
  const seedFile = (await fs.readFile(SEED_FILE_PATH, 'utf8')).split('\n')
  if (cleanSeedFile) {
    console.log('- Clean seed file')
    removeFileValues(seedFile)
  }

  // Exit if there is no input
  if (contactCodes.length > 0) {
    // 2. Read the column order for each table from seedFile.
    const columnOrderMap: Record<string, string[]> = {
      cmctc: columnOrder(seedFile, 'cmctc'),
      cmtel: columnOrder(seedFile, 'cmtel'),
      cmeml: columnOrder(seedFile, 'cmeml'),
      cmadr: columnOrder(seedFile, 'cmadr'),
    }

    // 3. Connect to the remote test or production Xpand DB.
    const pool = await connect()

    // 4. Get keycmobj's for contact code inputs:
    const keycmobjs = (
      await pool.query(
        `SELECT keycmobj FROM cmctc WHERE cmctckod IN (${contactCodes.map((o) => `'${o}'`).join(', ')})`
      )
    ).recordset.map((cmr) => cmr.keycmobj)

    // 4. Read the rows for the input `keycmobj` IDs
    for (const table of Object.keys(TABLES) as TableName[]) {
      console.log(`Importing "${table}" rows...`)
      const resultset = await pool.query(
        `SELECT * FROM ${table} WHERE ${TABLES[table]} IN (${keycmobjs.map((o) => `'${o}'`).join(', ')})`
      )
      console.log(`- Selected ${resultset.recordset.length} rows`)

      const valueRows = resultset.recordset.map((row) =>
        toValues(sanitizeColumns[table](row), columnOrderMap[table])
      )

      spliceValues(seedFile, table, valueRows)

      console.log(`- Added ${valueRows.length} rows.`)
    }

    await pool.close()
  } else {
    console.log('- No contacts to import')
  }

  // 5. Write the modified seed file lines back to disk
  await fs.writeFile(SEED_FILE_PATH, seedFile.join('\n'), 'utf8')

  console.log('Wrote result to', SEED_FILE_PATH)
}

run()
  .then(() => {
    console.log('Done!')
  })
  .catch((err) => {
    console.error('TERROR! ERROR! RUN! ALIEN INVASION! RUN! RUN!')
    console.log(err)
  })
