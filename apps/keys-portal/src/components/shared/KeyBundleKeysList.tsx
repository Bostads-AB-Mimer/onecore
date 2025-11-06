import React from 'react'
import {
  LoanableKeyTableBase,
  type LoanableKeyTableConfig,
} from './LoanableKeyTableBase'
import { Badge } from '@/components/ui/badge'
import type { GroupedKeys } from '@/utils/groupKeys'
import { formatAbsoluteTime } from '@/lib/dateUtils'

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
  // Custom loan header for key bundles (shows contact person and pickup date)
  const loanHeaderRenderer = (loan: any) => (
    <div className="flex items-center gap-3">
      <Badge variant="outline">Lånad</Badge>
      {loan.loanContactPerson && (
        <span className="text-muted-foreground">
          Kontakt: {loan.loanContactPerson}
        </span>
      )}
      {loan.loanPickedUpAt && (
        <span className="text-muted-foreground">
          Upphämtad: {formatAbsoluteTime(loan.loanPickedUpAt)}
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
      group={group}
      companyNames={companyNames}
      config={config}
      selectedKeys={selectedKeys}
      onKeySelectionChange={onKeySelectionChange}
    />
  )
}
