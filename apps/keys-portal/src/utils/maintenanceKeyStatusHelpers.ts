import type { KeyWithMaintenanceLoanStatus } from '@/services/types'

/**
 * Get display status for a maintenance key (bundle key)
 * Similar to getKeyDisplayStatus but simplified for maintenance loan context
 *
 * @param key - Key with maintenance loan status
 * @returns Object with status text and CSS color class
 */
export function getMaintenanceKeyDisplayStatus(
  key: KeyWithMaintenanceLoanStatus
): {
  status: string
  statusColor: string
} {
  // Priority 1: Check for incomplete events (FLEX ordered, etc.)
  if (key.latestEvent && key.latestEvent.status !== 'COMPLETED') {
    // Show event status (e.g., "FLEX beställd")
    const eventLabels: Record<string, string> = {
      FLEX_ORDERED: 'FLEX beställd',
      FLEX_DELIVERED: 'FLEX levererad',
      INCOMING_FLEX_ORDERED: 'Inflyttningsflex beställd',
      INCOMING_FLEX_DELIVERED: 'Inflyttningsflex levererad',
    }
    const eventLabel =
      eventLabels[key.latestEvent.eventType] || key.latestEvent.eventType
    return {
      status: eventLabel,
      statusColor: 'text-muted-foreground',
    }
  }

  // Priority 2: Check if key has an active maintenance loan
  if (key.maintenanceLoan && !key.maintenanceLoan.returnedAt) {
    const company = key.maintenanceLoan.company || 'Okänd'

    // Check if the loan has been picked up
    if (key.maintenanceLoan.pickedUpAt) {
      return {
        status: `Utlånad till ${company}`,
        statusColor: 'text-destructive', // Red - loaned out
      }
    } else {
      // Loan created but not picked up yet
      return {
        status: `Redo att hämtas (${company})`,
        statusColor: 'text-green-600 dark:text-green-400', // Green - available to pick up
      }
    }
  }

  // Priority 3: Check if key was previously loaned (returned)
  if (key.maintenanceLoan && key.maintenanceLoan.returnedAt) {
    const company = key.maintenanceLoan.company || 'okänd'
    return {
      status: `Återlämnad av ${company}`,
      statusColor: 'text-muted-foreground', // Muted - returned
    }
  }

  // Priority 4: Key has never been loaned
  return {
    status: 'Ny',
    statusColor: 'text-green-600 dark:text-green-400', // Green - available/new
  }
}
