import { maintenanceKeysService } from './api/maintenanceKeysService'
import type { Key } from './types'

export type CreateMaintenanceLoanParams = {
  keyIds: string[]
  keys?: Key[] // Optional: full key objects for better error messages
  company: string
  contactPerson?: string
  description?: string
}

export type CreateMaintenanceLoanResult = {
  success: boolean
  title: string
  message?: string
  loanId?: string
}

/**
 * Handler for creating maintenance key loans
 * @param keyIds - Array of key IDs to loan
 * @param keys - Optional: full key objects for better error messages
 * @param company - Company code (e.g., "E123456")
 * @param contactPerson - Contact person name
 * @param description - Loan description
 * @returns Result with success status and loanId
 */
export async function handleCreateMaintenanceLoan({
  keyIds,
  keys,
  company,
  contactPerson,
  description,
}: CreateMaintenanceLoanParams): Promise<CreateMaintenanceLoanResult> {
  if (keyIds.length === 0) {
    return {
      success: false,
      title: 'Fel',
      message: 'Inga nycklar valda',
    }
  }

  try {
    // Create the maintenance key loan
    const created = await maintenanceKeysService.create({
      keys: JSON.stringify(keyIds),
      company,
      contactPerson,
      description,
    })

    return {
      success: true,
      title: 'Fastighetsnyckel utlånad',
      message: `Lånet har skapats för ${company}`,
      loanId: created.id,
    }
  } catch (err: any) {
    const is409 = err?.status === 409 || err?.message?.includes('409')

    // Build detailed error message for 409 conflicts
    if (is409 && err?.data) {
      const conflictingKeyIds: string[] = err.data.conflictingKeys || []
      const conflictDetails: Array<{
        keyId: string
        conflictType: 'regular' | 'maintenance'
      }> = err.data.conflictDetails || []

      if (conflictingKeyIds.length > 0 && keys) {
        // Build specific error messages for each conflicting key
        const messages = conflictingKeyIds.map((keyId) => {
          const key = keys.find((k) => k.id === keyId)
          const detail = conflictDetails.find((d) => d.keyId === keyId)

          if (!key) {
            return `Nyckel ${keyId.substring(0, 8)}... är redan utlånad`
          }

          if (detail?.conflictType === 'maintenance') {
            // Another maintenance loan
            return `${key.keyName} är redan utlånad som fastighetsnyckel`
          } else {
            // Regular loan
            return `${key.keyName} är utlånad till en hyresgäst`
          }
        })

        return {
          success: false,
          title: 'Kan inte låna ut',
          message: messages.join('\n'),
        }
      }

      // Fallback if we don't have key details
      return {
        success: false,
        title: 'Kan inte låna ut',
        message: 'En eller flera nycklar är redan utlånade.',
      }
    }

    return {
      success: false,
      title: is409 ? 'Kan inte låna ut' : 'Fel',
      message: is409
        ? 'En eller flera nycklar är redan utlånade.'
        : err?.message || 'Ett fel uppstod när lånet skulle skapas.',
    }
  }
}
