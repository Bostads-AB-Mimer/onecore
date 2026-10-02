import path from 'path'
import fs from 'node:fs'

export function projectRoot(start = process.cwd()) {
  if (typeof __dirname !== 'undefined') return `${__dirname}/../..`
  let dir = start

  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }

    const parent = path.dirname(dir)
    if (parent === dir) {
      throw new Error('Project root not found')
    }

    dir = parent
  }
}
