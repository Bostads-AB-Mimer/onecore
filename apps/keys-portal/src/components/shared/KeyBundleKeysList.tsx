import { useMemo } from 'react'
import {
  LoanableKeyTableBase,
  type LoanableKeyTableConfig,
} from './LoanableKeyTableBase'
import { Badge } from '@/components/ui/badge'
import type { GroupedKeys } from '@/utils/groupKeys'
import { formatAbsoluteTime } from '@/lib/dateUtils'
import type { KeyWithLoanAndEvent } from '@/services/types'

interface KeyBundleKeysListProps {
  group: GroupedKeys['nonDisposed'] | GroupedKeys['disposed']
  companyNames: Record<string, string>
  selectable?: boolean
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
}

/**
 * Component for displaying keys in key bundles, grouped by company and loan with collapsible headers.
 * Can optionally include checkboxes for key selection.
 */
export function KeyBundleKeysList({
  group,
  companyNames,
  selectable = false,
  selectedKeys = [],
  onKeySelectionChange,
}: KeyBundleKeysListProps) {
  // Flatten the grouped keys into a single array
  const keys = useMemo(() => {
    const result: KeyWithLoanAndEvent[] = []

    // Add all loaned keys
    group.loaned.forEach((contactGroup) => {
      contactGroup.loans.forEach((loan) => {
        result.push(...loan.keys)
      })
    })

    // Add all unloaned keys
    result.push(...group.unloaned)

    return result
  }, [group])

  // Custom loan header for key bundles (shows contact person and pickup date)
  const loanHeaderRenderer = (loan: any) => (
    <div className="flex items-center gap-3">
      <Badge variant="outline">Lånad</Badge>
      {loan.contactPerson && (
        <span className="text-muted-foreground">
          Kontakt: {loan.contactPerson}
        </span>
      )}
      {loan.pickedUpAt && (
        <span className="text-muted-foreground">
          Upphämtad: {formatAbsoluteTime(loan.pickedUpAt)}
        </span>
      )}
    </div>
  )

  const config: LoanableKeyTableConfig = {
    columns: {
      keyName: true,
      sequence: true,
      flex: true,
      status: true,
      type: true,
      rentalObject: true,
    },
    showContactHeaders: true,
    showLoanHeaders: true,
    customLoanHeaderRenderer: loanHeaderRenderer,
    selectable,
  }

  return (
    <LoanableKeyTableBase
      keys={keys}
      companyNames={companyNames}
      config={config}
      selectedKeys={selectedKeys}
      onKeySelectionChange={onKeySelectionChange}
    />
  )
}
