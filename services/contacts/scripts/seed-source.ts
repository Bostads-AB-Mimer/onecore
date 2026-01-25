#!/bin/env -S node -r ts-node/register

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { connect } from './db'
import { ConnectionPool } from 'mssql'

const query = (cc: string) => {
  return `
  SELECT
  cmctc.keycmctc,
  cmctc.cmctckod as contactCode,
  cmctc.fnamn,
  cmctc.enamn,
  cmctc.cmctcben,
  cmctc.persorgnr,
  cmctc.birthdate,
  cmctc.keycmobj,
  cmctc.keycmctc,
  cmctc.lagsokt,
  cmctc.utslag,
  cmadr.keycmadr as addressId,
  cmadr.keycmtyp as addressType,
  cmadr.region,
  cmadr.keycode,
  cmadr.adress1,
  cmadr.adress2,
  cmadr.adress3,
  cmadr.adress4,
  cmadr.adress5,
  cmadr.adress6,
  cmadr.adress7,
  cmadr.adress8,
  cmadr.adress9,
  cmadr.adress10,
  cmadr.tdate,
  cmeml.keycmeml as emailId,
  cmeml.cmemlben as emailAddress,
  cmeml.main as isPrimaryEmail,
  cmtel.keycmtel as phoneId,
  cmtel.cmtelben as phoneNumber,
  cmtel.keycmtet as phoneType,
  cmtel.main as isPrimaryPhone
FROM
  cmctc
LEFT JOIN cmadr ON cmadr.keycode = cmctc.keycmobj
LEFT JOIN cmtel ON cmtel.keycmobj = cmctc.keycmobj
LEFT JOIN cmeml ON cmeml.keycmobj = cmctc.keycmobj
WHERE cmctc.cmctckod LIKE '${cc}%'
`
}

const readFile = async (fileName: string) => {
  if (!existsSync(fileName)) {
    return []
  }
  return (await fs.readFile(fileName, 'utf8')).split('\n')
}

const writeFile = async (fileName: string, lines: string[]) => {
  if (!existsSync(fileName)) {
    console.log('Writing to new file: ' + fileName)
  }

  return await fs.writeFile(fileName, lines.join('\n'), 'utf8')
}

const presentp = (
  sym: string,
  val: any,
  opts: { fmt: 'sym' | 'sym:'; emptySym?: string } = { fmt: 'sym:' }
) => {
  const pSym = 'y'
  const nullSym = '-'
  const valType =
    (val === undefined || val === null
      ? nullSym
      : typeof val === 'string'
        ? val.trim().length === 0
          ? opts.emptySym
          : pSym
        : pSym) || nullSym

  return opts.fmt === 'sym:'
    ? `${sym}:${valType}`
    : valType === pSym
      ? sym
      : opts.emptySym || nullSym
}

const ccSym = (cc: string) => {
  const lead = cc.charAt(0)
  switch (cc.charAt(0)) {
    case 'P':
    case 'F':
    case 'I':
    case 'K':
      return lead
    default:
      return '-'
  }
}

const count = (sym: string, coll: any[], zeroSym?: string) => {
  return `${sym}:${zeroSym && coll.length == 0 ? zeroSym : coll.length}`
}

const usefulCount = (
  sym: string,
  coll: any[],
  usefulp: (r: any) => boolean,
  zeroSym?: string
) => {
  const useful = coll.filter(usefulp)
  return useful.length === coll.length
    ? count(sym, coll, zeroSym)
    : `${sym}:${useful.length}/${coll.length}`
}

const unique = (rows: any[], key: string) => {
  const seen: string[] = []
  return rows.filter((r) => {
    if (!r[key] != seen.includes(r[key])) return false
    seen.push(r[key])
    return true
  })
}

const group = (sym: string, emptySym: string, ...parts: string[]) => {
  const full = `${sym}(${parts.length ? parts.join(' ') : emptySym})`
  if (parts[0].includes('#:-')) {
    return sym.padEnd(full.length)
  }
  return full
}

const expiredAddrp = (r: any) => {
  return Boolean(r.tdate)
}

const usefulAddrp = (r: any) => {
  return (
    !expiredAddrp(r) &&
    [
      'adress1',
      'adress2',
      'adress3',
      'adress4',
      'adress5',
      'adress6',
      'adress7',
      'adress8',
      'adress9',
      'adress10',
    ]
      .map((k) => r[k])
      .some((l) => l && l.trim())
  )
}

const fileIndex = (file: string[], ccToFind: string) => {
  return file.findIndex((l) => {
    const [cc] = l.trim().split(' ')
    return cc === ccToFind
  })
}

const add = async (
  pool: ConnectionPool,
  file: string[],
  ...contactCodes: string[]
) => {
  for (const cc of contactCodes) {
    const line = buildLine(await fetchContact(pool, cc))
    const idx = fileIndex(file, cc)
    if (line) {
      if (idx === -1) {
        console.log('ADD:', line)
        file.push(line)
      } else {
        console.log('UPDATE:', line)
        file[idx] = line
      }
    }
  }
}

const update = async (pool: ConnectionPool, file: string[]) => {
  const toRemove = []

  for (let i = 0; i < file.length; i++) {
    const [cc] = file[i].trim().split(' ')
    if (cc && !cc.startsWith('#')) {
      const line = buildLine(await fetchContact(pool, cc))
      if (line) {
        console.log('UPDATE:', line)
        file[i] = line
      } else {
        toRemove.push(cc)
      }
    }
  }

  toRemove.forEach((rcc) => {
    const idx = fileIndex(file, rcc)
    if (idx !== -1) {
      console.log('REMOVE:', file[idx])
      file.splice(idx, 1)
    }
  })
}

const buildLine = (rows: any[]) => {
  const [ctc] = rows

  if (!ctc) return
  const tel = unique(rows, 'phoneId')
  const eml = unique(rows, 'emailId')
  const adr = unique(rows, 'addressId')

  const cc = String(ctc.contactCode).trim()

  const line = [
    cc.padEnd(10),
    '### ',
    ccSym(cc),
    '|',
    presentp('N', ctc.cmctcben, { fmt: 'sym' }).padEnd(1),
    presentp('FN', ctc.fnamn, { fmt: 'sym' }).padEnd(2),
    presentp('LN', ctc.enamn, { fmt: 'sym' }).padEnd(2),
    presentp('ID', ctc.persorgnr, { fmt: 'sym' }).padEnd(2),
    '|',
    group('T', '-', count('#', tel, '-')),
    group('E', '-', count('#', eml, '-')),
    group(
      'A',
      '-',
      count('#', adr, '-').padEnd(4),
      count('U', adr.filter(usefulAddrp), '-').padEnd(4),
      count('X', adr.filter(expiredAddrp), '-')
    ),
  ].join(' ')

  return line
}

const fetchContact = async (pool: ConnectionPool, contactCode: string) => {
  const result = await pool.query(query(contactCode))
  return result.recordset
}

const usage = () => {
  console.log('Usage:')
  console.log('')
  console.log(
    'script:seed-source add <file-name> <contactCode> [<contactCode>...]'
  )
  console.log('script:seed-source update <file-name>')
  console.log()
}

const run = async (cmd: string, fileName: string, args: string[]) => {
  const pool = await connect()
  const file = await readFile(fileName)
  switch (cmd) {
    case 'add':
      if (args.length) {
        await add(pool, file, ...args)
      } else {
        usage()
      }
      break
    case 'update':
      await update(pool, file)
      break
  }

  console.log('Writing result...')
  await writeFile(fileName, file)

  pool.close()
}

const [cmd, fileName, ...args] = process.argv.slice(2)

if (cmd && fileName) {
  run(cmd, fileName, args).then(() => {})
} else {
  usage()
}
