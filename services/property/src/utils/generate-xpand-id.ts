import { randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const PREFIX = 'O'
const TS_LENGTH = 8
const RAND_LENGTH = 6

const toBase36Upper = (n: number, len: number): string =>
  n.toString(36).toUpperCase().padStart(len, '0').slice(-len)

/**
 * Generates a 15-char ID suitable for Char(15) Xpand key columns
 * (keycmobj, keybarum, keybabuf, etc.).
 *
 * Format: `O` + 8 base-36 chars encoding seconds-since-epoch + 6 random
 * chars from [A-Z0-9] = 15 chars. The `O` prefix marks ONECore origin;
 * the timestamp prefix makes IDs monotonically increasing so newer rooms
 * sort after older ones in the Xpand client (which orders rooms
 * lexicographically by the underlying key under CI_AS collation).
 *
 * Collision math: 36^6 ≈ 2.2 billion possibilities per second — negligible
 * collision risk at any realistic write rate.
 */
export const generateXpandId = (): string => {
  const ts = toBase36Upper(Math.floor(Date.now() / 1000), TS_LENGTH)
  const bytes = randomBytes(RAND_LENGTH)
  let rand = ''
  for (let i = 0; i < RAND_LENGTH; i++) {
    rand += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return PREFIX + ts + rand
}
