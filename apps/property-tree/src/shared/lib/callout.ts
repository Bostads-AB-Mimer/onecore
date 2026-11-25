import type { guides } from '@onecore/types'

/** Display name of each callout type, shown in the callout and the editor. */
export const CALLOUT_LABELS: Record<guides.CalloutType, string> = {
  tip: 'Tips',
  note: 'Obs',
  warning: 'Varning',
}
