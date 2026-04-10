import { keyLoanService } from './api/keyLoanService'
import { receiptService } from './api/receiptService'
import type { UpdateKeyLoanRequest } from './types'

export type EditKeyLoanResult = {
  success: boolean
  title: string
  message?: string
}

export function validateReceiptFile(file: File): EditKeyLoanResult | null {
  if (file.type !== 'application/pdf') {
    return {
      success: false,
      title: 'Fel',
      message: 'Endast PDF-filer är tillåtna',
    }
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      success: false,
      title: 'Fel',
      message: 'Filen är för stor (max 10 MB)',
    }
  }

  return null
}

export async function updateKeyLoan(
  loanId: string,
  data: UpdateKeyLoanRequest
): Promise<EditKeyLoanResult> {
  try {
    await keyLoanService.update(loanId, data)
    return {
      success: true,
      title: 'Uppdaterat',
      message: 'Nyckellånet har uppdaterats',
    }
  } catch (error) {
    console.error('Failed to update key loan:', error)
    return {
      success: false,
      title: 'Fel',
      message: 'Kunde inte uppdatera nyckellånet',
    }
  }
}

export async function uploadLoanReceipt(
  loanId: string,
  file: File
): Promise<EditKeyLoanResult> {
  try {
    const receipts = await receiptService.getByKeyLoan(loanId)
    const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

    if (!loanReceipt) {
      await receiptService.createWithFile(
        { keyLoanId: loanId, receiptType: 'LOAN', type: 'PHYSICAL' },
        file
      )
    } else {
      await receiptService.uploadFile(loanReceipt.id, file)
    }

    return {
      success: true,
      title: loanReceipt?.fileId ? 'Kvittens ersatt' : 'Kvittens uppladdad',
      message: loanReceipt?.fileId
        ? 'Den nya kvittensen har ersatt den gamla'
        : 'Kvittensen har laddats upp',
    }
  } catch (error) {
    console.error('Failed to upload receipt:', error)
    return {
      success: false,
      title: 'Fel',
      message: 'Kunde inte ladda upp kvittensen',
    }
  }
}

export async function downloadLoanReceipt(
  loanId: string
): Promise<EditKeyLoanResult> {
  try {
    const receipts = await receiptService.getByKeyLoan(loanId)
    const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

    if (loanReceipt) {
      await receiptService.downloadFile(loanReceipt.id)
    }

    return { success: true, title: '', message: '' }
  } catch (error) {
    console.error('Failed to download receipt:', error)
    return {
      success: false,
      title: 'Fel',
      message: 'Kunde inte ladda ner kvittensen',
    }
  }
}

export async function deleteLoanReceipt(
  loanId: string
): Promise<EditKeyLoanResult> {
  try {
    const receipts = await receiptService.getByKeyLoan(loanId)
    const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

    if (loanReceipt) {
      await receiptService.remove(loanReceipt.id)
      await keyLoanService.update(loanId, { pickedUpAt: null })
    }

    return {
      success: true,
      title: 'Kvittens borttagen',
      message:
        'Kvittensen har tagits bort och lånet är nu markerat som ej upphämtat',
    }
  } catch (error) {
    console.error('Failed to delete receipt:', error)
    return {
      success: false,
      title: 'Fel',
      message: 'Kunde inte ta bort kvittensen',
    }
  }
}

export async function deleteKeyLoan(
  loanId: string
): Promise<EditKeyLoanResult> {
  try {
    await keyLoanService.remove(loanId)
    return {
      success: true,
      title: 'Nyckellån borttaget',
      message: 'Lånet har tagits bort',
    }
  } catch (error: any) {
    console.error('Failed to delete loan:', error)
    if (error?.data?.code === 'ACTIVE_LOAN_CANNOT_DELETE') {
      return {
        success: false,
        title: 'Kan inte ta bort aktivt lån',
        message: 'Lånet kan inte tas bort medan nycklar är uthyrda.',
      }
    }
    return {
      success: false,
      title: 'Kunde inte ta bort lånet',
      message: 'Ett fel uppstod när lånet skulle tas bort',
    }
  }
}
