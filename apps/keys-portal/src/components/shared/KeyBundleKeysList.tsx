import { useMemo } from 'react'
import {
  LoanableKeyTableBase,
  type LoanableKeyTableConfig,
} from './LoanableKeyTableBase'
import type { GroupedKeys } from '@/utils/groupKeys'
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

  const config: LoanableKeyTableConfig = {
    columns: {
      keyName: true,
      sequence: true,
      flex: true,
      keySystem: true, // Show key system code
      status: true,
      type: true,
      rentalObject: true,
    },
    showContactHeaders: true,
    showLoanHeaders: true,
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
