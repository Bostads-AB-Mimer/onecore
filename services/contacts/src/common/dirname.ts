import path from 'path'
import { fileURLToPath } from 'url'

export function getDirname(metaUrl?: string) {
  if (typeof __dirname !== 'undefined') return __dirname
  return path.dirname(fileURLToPath(metaUrl!))
}
