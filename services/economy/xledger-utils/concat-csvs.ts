import fs from 'fs'
import path from 'path'
import os from 'os'

const globChars = /[*?]/

const expandSegment = (base: string, segment: string): string[] => {
  const regex = new RegExp(
    '^' +
      segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '.') +
      '$'
  )

  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => regex.test(entry.name))
    .map((entry) => path.join(base, entry.name))
}

const expandPattern = (pattern: string): string[] => {
  let candidate = pattern.startsWith('~')
    ? path.join(os.homedir(), pattern.slice(1))
    : path.resolve(pattern)

  let bases = [path.dirname(candidate)]
  let remaining = path.relative(path.dirname(candidate), candidate).split(path.sep)
  const matched: string[] = []

  while (remaining.length > 0) {
    const segment = remaining.shift() as string
    const next: string[] = []

    for (const base of bases) {
      if (globChars.test(segment)) {
        next.push(...expandSegment(base, segment))
      } else {
        const resolved = path.join(base, segment)
        if (remaining.length === 0 || fs.existsSync(resolved)) {
          next.push(resolved)
        }
      }
    }

    bases = next
  }

  for (const candidate of bases) {
    try {
      const stat = fs.statSync(candidate)
      if (stat.isFile()) {
        matched.push(candidate)
      }
    } catch {
      // Ignore entries that disappeared between listing and stat
    }
  }

  return matched
}

const removeTrailingEmptyLines = (lines: string[]): string[] => {
  const linesCopy = [...lines]
  while (
    linesCopy.length > 0 &&
    linesCopy[linesCopy.length - 1].trim() === ''
  ) {
    linesCopy.pop()
  }

  return linesCopy
}

const concatCsvs = () => {
  const args = process.argv.slice(2)

  if (args.length < 1 || args.length > 2) {
    console.error(
      'Usage: ts-node xledger-utils/concat-csvs <glob-pattern> [output-file]\n' +
        'The pattern must be quoted so the shell does not expand it, e.g.\n' +
        '  ts-node xledger-utils/concat-csvs "~/dir/*-001-ledger.gl.csv" out.csv'
    )
    process.exit(1)
  }

  const [pattern, outputFile] = args

  const outputPath = path.resolve(
    outputFile ??
      path.join(path.dirname(path.resolve(pattern)), 'concat.csv')
  )

  const files = expandPattern(pattern)
    .sort()
    .filter((file) => path.resolve(file) !== outputPath)

  if (files.length === 0) {
    console.error(`No files matched pattern: ${pattern}`)
    process.exit(1)
  }

  const outputChunks: string[] = []

  files.forEach((file, index) => {
    const lines = removeTrailingEmptyLines(
      fs.readFileSync(file, 'utf8').split('\n').map((line) => line.replace(/\r$/, ''))
    )

    if (index === 0) {
      outputChunks.push(lines.join('\n'))
    } else {
      outputChunks.push(lines.slice(1).join('\n'))
    }

    console.log(`Concatenated ${file}`)
  })

  const output = outputChunks.join('\n') + '\n'

  fs.writeFileSync(outputPath, output)

  console.log(`Wrote ${files.length} concatenated files to ${outputPath}`)
}

concatCsvs()
