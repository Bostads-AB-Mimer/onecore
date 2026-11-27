import { useMessageTemplate } from '@/entities/message-template'
import { useSystemTemplate } from '@/entities/system-template'

import type { TemplateEditTarget } from '../lib/editTarget'

/**
 * The saved version of the template being edited, fetched only while
 * `enabled`: the conflict warning shows who saved it and resubmits at its revision.
 */
export function useLatestTemplate(
  target: TemplateEditTarget,
  enabled: boolean
) {
  const system = useSystemTemplate(
    enabled && target.kind === 'system' ? target.template.key : null
  )
  const sms = useMessageTemplate(
    enabled && target.kind === 'sms' ? (target.template?.id ?? null) : null
  )
  const query = target.kind === 'system' ? system : sms
  return {
    // A refetch for a later conflict must not offer the earlier revision.
    latest: query.isFetching ? undefined : query.data,
    isError: query.isError,
  }
}
