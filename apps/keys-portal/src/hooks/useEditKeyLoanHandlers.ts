import { useCallback } from 'react'

import {
  updateKeyLoan,
  uploadLoanReceipt,
  downloadLoanReceipt,
  deleteLoanReceipt,
  deleteKeyLoan,
  validateReceiptFile,
} from '@/services/editKeyLoanHandlers'
import type { EditKeyLoanResult } from '@/services/editKeyLoanHandlers'
import type { UpdateKeyLoanRequest } from '@/services/types'

import { useToast } from './use-toast'

interface UseEditKeyLoanHandlersOptions {
  onSuccess?: () => void | Promise<void>
  onClose?: () => void
}

export function useEditKeyLoanHandlers({
  onSuccess,
  onClose,
}: UseEditKeyLoanHandlersOptions = {}) {
  const { toast } = useToast()

  const showResult = useCallback(
    (result: EditKeyLoanResult) => {
      if (result.title) {
        toast({
          title: result.title,
          description: result.message,
          variant: result.success ? undefined : 'destructive',
        })
      }
    },
    [toast]
  )

  const handleSave = useCallback(
    async (loanId: string, data: UpdateKeyLoanRequest) => {
      const result = await updateKeyLoan(loanId, data)
      showResult(result)
      if (result.success) {
        onClose?.()
        await onSuccess?.()
      }
    },
    [showResult, onClose, onSuccess]
  )

  const handleReceiptUpload = useCallback(
    async (loanId: string, file: File) => {
      const result = await uploadLoanReceipt(loanId, file)
      showResult(result)
      if (result.success) {
        await onSuccess?.()
      }
      if (!result.success) {
        throw new Error(result.message)
      }
    },
    [showResult, onSuccess]
  )

  const handleReceiptDownload = useCallback(
    async (loanId: string) => {
      const result = await downloadLoanReceipt(loanId)
      if (!result.success) {
        showResult(result)
        throw new Error(result.message)
      }
    },
    [showResult]
  )

  const handleReceiptDelete = useCallback(
    async (loanId: string) => {
      const result = await deleteLoanReceipt(loanId)
      showResult(result)
      if (result.success) {
        await onSuccess?.()
      }
      if (!result.success) {
        throw new Error(result.message)
      }
    },
    [showResult, onSuccess]
  )

  const handleDelete = useCallback(
    async (loanId: string) => {
      const result = await deleteKeyLoan(loanId)
      showResult(result)
      if (result.success) {
        onClose?.()
        await onSuccess?.()
      }
    },
    [showResult, onClose, onSuccess]
  )

  const validateFile = useCallback(
    (file: File): boolean => {
      const error = validateReceiptFile(file)
      if (error) {
        showResult(error)
        return false
      }
      return true
    },
    [showResult]
  )

  return {
    handleSave,
    handleReceiptUpload,
    handleReceiptDownload,
    handleReceiptDelete,
    handleDelete,
    validateFile,
  }
}
