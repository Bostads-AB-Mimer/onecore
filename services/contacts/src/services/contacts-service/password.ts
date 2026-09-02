import { randomInt } from 'crypto'

/**
 * Character set for generated passwords.
 *
 * Deliberately conservative: upper case, lower case, digits and a small set of
 * symbols that are unambiguous in a SOAP envelope and in an email. Xpand's
 * password rules are not documented anywhere we can read, so the safe move is
 * to stay well inside what any policy would accept rather than maximise
 * entropy per character.
 */
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const LENGTH = 24

/**
 * Generates the initial password for a newly provisioned web account.
 *
 * Policy: a high-entropy value that is never returned to any caller, never
 * logged, and never stored on our side. The customer sets their own password
 * through the "forgot password" flow instead.
 *
 * That flow only works for contacts the public site's own API knows about, so
 * this policy depends on the password-reset fallback being deployed. Until it
 * is, a customer created here can neither sign in nor reset.
 *
 * SWAP POINT — if the policy changes to caller-supplied or shown-once, this
 * module and the `password` field on the request schema are the only things
 * that need to change. Nothing downstream reads the value.
 *
 * Uses `randomInt`, which draws from the same CSPRNG as `randomBytes` but
 * without the modulo bias that indexing a 64-character alphabet by a raw byte
 * would introduce.
 */
export const generateInitialPassword = (): string => {
  let password = ''
  for (let i = 0; i < LENGTH; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)]
  }
  return password
}
