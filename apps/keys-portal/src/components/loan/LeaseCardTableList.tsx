import { useMemo } from 'react'
import {
  LoanableCardTableBase,
  type LoanableCardTableConfig,
} from '@/components/shared/LoanableCardTableBase'
import { CardDetails } from '@/services/types'

interface LeaseCardTableListProps {
  cards: CardDetails[]
  tenantContactCodes?: string[]
  selectable?: boolean
  selectedCards?: string[]
  onCardSelectionChange?: (cardId: string, checked: boolean) => void
}

/**
 * Component for displaying cards in lease context with table layout.
 * Similar to LeaseKeyTableList but for access control cards.
 * - Uses LoanableCardTableBase which supports expandable rows to show codes
 * - Shows contact name as "Denna hyresgäst" for matching tenants
 */
export function LeaseCardTableList({
  cards,
  tenantContactCodes = [],
  selectable = true,
  selectedCards = [],
  onCardSelectionChange,
}: LeaseCardTableListProps) {
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

  // Transform card loans to show "Denna hyresgäst" for matching tenants
  const transformedCards = useMemo(() => {
    return cards.map((card) => {
      // Transform loans if they exist
      const transformedLoans = card.loans?.map((loan) => {
        const activeLoan = card.loans?.find((l) => l.returnedAt === null)
        const previousLoan = card.loans?.find((l) => l.returnedAt !== null)

        // Transform active loan if it exists
        if (activeLoan && loan.id === activeLoan.id) {
          return transformLoanIfMatchesTenant(loan)
        }
        // Transform previous loan ONLY if there's no active loan
        if (!activeLoan && previousLoan && loan.id === previousLoan.id) {
          return transformLoanIfMatchesTenant(loan)
        }
        return loan
      })

      return {
        ...card,
        loans: transformedLoans || [],
      }
    })
  }, [cards, tenantContactCodes])

  const config: LoanableCardTableConfig = {
    columns: {
      cardName: true,
      status: true,
      pickupAvailability: true,
      disposal: true,
    },
    showContactHeaders: false,
    showLoanHeaders: true,
    selectable,
  }

  return (
    <LoanableCardTableBase
      cards={transformedCards}
      config={config}
      selectedCards={selectedCards}
      onCardSelectionChange={onCardSelectionChange}
    />
  )
}
