import { useState } from 'react'
import { inspectionService } from '@/services/api/core/inspectionService'
import { components } from '@/services/api/core/generated/api-types'

type SendProtocolResponse = components['schemas']['SendProtocolResponse']

export interface UseSendInspectionProtocolReturn {
  sendProtocol: (
    inspectionId: string,
    recipient: 'new-tenant' | 'previous-tenant'
  ) => Promise<SendProtocolResponse>
  isSending: boolean
  error: Error | null
}

export function useSendInspectionProtocol(): UseSendInspectionProtocolReturn {
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sendProtocol = async (
    inspectionId: string,
    recipient: 'new-tenant' | 'previous-tenant'
  ): Promise<SendProtocolResponse> => {
    try {
      setIsSending(true)
      setError(null)
      const result = await inspectionService.sendProtocol(
        inspectionId,
        recipient
      )
      return result
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to send protocol')
      setError(error)
      throw error
    } finally {
      setIsSending(false)
    }
  }

  return {
    sendProtocol,
    isSending,
    error,
  }
}
