import type { KeyLoan } from '@/services/types'
import { GET } from './core/base-api'

export const keyLoanService = {
  /**
   * Get all key loans for a rental property/lease by rental property ID
   * Returns active and returned loans separately
   */
  async getByRentalPropertyId(
    rentalPropertyId: string
  ): Promise<{ activeLoans: KeyLoan[]; returnedLoans: KeyLoan[] }> {
    try {
      const keysResponse = await GET(
        '/keys/by-rental-object/{rentalObjectCode}',
        {
          params: { path: { rentalObjectCode: rentalPropertyId } },
        }
      )

      if (keysResponse.error || !keysResponse.data?.content) {
        return { activeLoans: [], returnedLoans: [] }
      }

      const keys = keysResponse.data.content

      const allLoans: KeyLoan[] = []
      const loanMap = new Map<string, KeyLoan>()

      for (const key of keys) {
        const loansResponse = await GET('/key-loans/by-key/{keyId}', {
          params: { path: { keyId: key.id } },
        })

        if (loansResponse.data?.content) {
          const loans = loansResponse.data.content
          // Deduplicate by loan ID
          loans.forEach((loan) => loanMap.set(loan.id, loan))
        }
      }

      allLoans.push(...Array.from(loanMap.values()))

      // Separate active and returned loans
      const activeLoans = allLoans.filter((loan) => !loan.returnedAt)
      const returnedLoans = allLoans.filter((loan) => !!loan.returnedAt)

      return { activeLoans, returnedLoans }
    } catch (error) {
      console.error('Error fetching key loans:', error)
      return { activeLoans: [], returnedLoans: [] }
    }
  },

  /**
   * Get a single key loan by ID
   */
  async getById(id: string): Promise<KeyLoan | null> {
    try {
      const { data, error } = await GET('/key-loans/{id}', {
        params: { path: { id } },
      })

      if (error || !data?.content) {
        return null
      }

      return data.content as KeyLoan
    } catch (error) {
      console.error('Error fetching key loan:', error)
      return null
    }
  },
}
