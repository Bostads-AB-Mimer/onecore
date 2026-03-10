import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyBundle = keys.KeyBundle

/**
 * Factory for generating KeyBundle test data.
 *
 * Note: keys are stored in the junction table (key_bundle_keys)
 * and are not part of the KeyBundle response schema.
 * Pass them in CreateKeyBundleRequest when creating bundles.
 */
export const KeyBundleFactory = Factory.define<KeyBundle>(({ sequence }) => {
  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    name: `Bundle ${sequence}`,
    description: `Test bundle ${sequence}`,
  }
})
