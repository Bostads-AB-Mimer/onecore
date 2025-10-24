import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyBundle = keys.v1.KeyBundle

/**
 * Factory for generating KeyBundle test data.
 *
 * The `keys` field is a JSON string array of key IDs.
 * By default, it generates a single key ID, but you can override with multiple:
 *
 * @example
 * // Single key (default)
 * const bundle = KeyBundleFactory.build()
 *
 * @example
 * // Multiple keys
 * const bundle = KeyBundleFactory.build({
 *   keys: JSON.stringify(['key-id-1', 'key-id-2', 'key-id-3'])
 * })
 */
export const KeyBundleFactory = Factory.define<KeyBundle>(({ sequence }) => {
  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    name: `Bundle ${sequence}`,
    keys: JSON.stringify([`key-${sequence}`]), // JSON string array with single key by default
    description: `Test bundle ${sequence}`,
  }
})
