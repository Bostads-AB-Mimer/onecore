import { useMemo } from 'react'
import {
  LoanableKeyTableBase,
  type LoanableKeyTableConfig,
} from '@/components/shared/LoanableKeyTableBase'
import { KeyWithLoanAndEvent } from '@/services/types'

interface LeaseKeyTableListProps {
  keys: KeyWithLoanAndEvent[]
  tenantContactCodes?: string[]
  selectable?: boolean
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
}

/**
 * Component for displaying keys in lease context with table layout.
 * - Hides contact headers (not needed when there are few loans)
 * - Shows contact name in loan header instead
 * - Shows loan type (TENANT vs MAINTENANCE)
 * - Hides rental object column (already in lease context)
 * - Includes disposed keys with active loans
 * - Transforms matching tenant contacts to "Denna hyresgäst"
 */
export function LeaseKeyTableList({
  keys,
  tenantContactCodes = [],
  selectable = true,
  selectedKeys = [],
  onKeySelectionChange,
}: LeaseKeyTableListProps) {
  // Helper to transform loan contacts to "Denna hyresgäst" if they match tenant
  const transformLoanIfMatchesTenant = <
    T extends { contact?: string | null; contact2?: string | null },
  >(
    loan: T
  ): T => {
    const contactMatchesTenant =
      (loan.contact && tenantContactCodes.includes(loan.contact)) ||
      (loan.contact2 && tenantContactCodes.includes(loan.contact2))

    if (contactMatchesTenant) {
      return {
        ...loan,
        contact: 'Denna hyresgäst',
        contact2: null,
      }
    }
    return loan
  }

  // Transform keys to replace contact with "Denna hyresgäst" if it matches tenant
  const transformedKeys = useMemo(() => {
    if (tenantContactCodes.length === 0) return keys

    return keys.map((key) => {
      let transformedKey = { ...key }

      // Transform current loan if it exists
      if (key.loan) {
        transformedKey = {
          ...transformedKey,
          loan: transformLoanIfMatchesTenant(key.loan),
        }
      }

      // Transform previous loan ONLY if there's no active loan (key is in "Ej utlånade" section)
      if (key.previousLoan && !key.loan) {
        transformedKey = {
          ...transformedKey,
          previousLoan: transformLoanIfMatchesTenant(key.previousLoan),
        }
      }

      return transformedKey
    })
  }, [keys, tenantContactCodes])

  const config: LoanableKeyTableConfig = {
    columns: {
      keyName: true,
      sequence: true,
      flex: true,
      status: true,
      pickupAvailability: true, // Show pickup availability for key loans
      disposal: true, // Show disposal status (Kasserad/Aktiv)
      type: true,
      rentalObject: false, // Hide rental object in lease context
    },
    showContactHeaders: false, // Hide contact headers in lease context
    showLoanHeaders: true,
    selectable,
  }

  return (
    <LoanableKeyTableBase
      keys={transformedKeys}
      config={config}
      selectedKeys={selectedKeys}
      onKeySelectionChange={onKeySelectionChange}
    />
  )
}
