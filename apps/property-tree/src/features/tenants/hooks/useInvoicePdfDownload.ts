import { useMutation } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

import { downloadBlob } from '@/shared/lib/fileDownload'

// Resolves to false when there is no rent notice PDF for the invoice.
export const useInvoicePdfDownload = () =>
  useMutation({
    mutationFn: async (invoiceId: string): Promise<boolean> => {
      const pdf = await economyService.getInvoicePdf(invoiceId)
      if (!pdf) return false
      downloadBlob(pdf, `hyresavi-${invoiceId}.pdf`)
      return true
    },
  })
