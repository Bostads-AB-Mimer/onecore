import {
  Lease,
  LeaseStatus,
  EmailAttachment,
  InspectionProtocolEmail,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import type { DetailedInspection } from '../schemas'

/**
 * Identifies tenant and new tenant contracts from a list of leases.
 * Shared helper function used by both GET /tenant-contacts and POST /send-protocol endpoints.
 *
 * The tenant is identified by the inspection's leaseId (the lease active during inspection).
 * The new tenant is the latest non-ended housing contract (most recent start date), if different from the tenant.
 *
 * @param leases - All leases for a property
 * @param inspectionLeaseId - The leaseId from the inspection (identifies the tenant)
 * @returns Object with newTenant and tenant lease contracts
 */
export const identifyTenantContracts = (
  leases: Lease[],
  inspectionLeaseId: string
): { newTenant: Lease | null; tenant: Lease | null } => {
  // Filter for housing contracts only (exclude parking spaces)
  const housingContracts = leases
    .filter(
      (lease) =>
        lease.type.includes('Bostadskontrakt') ||
        lease.type.includes('Kooperativ hyresrätt')
    )
    .sort((a, b) => {
      // Sort by leaseStartDate ascending (oldest first)
      return (
        new Date(a.leaseStartDate).getTime() -
        new Date(b.leaseStartDate).getTime()
      )
    })

  // Tenant is the lease that was active during the inspection
  const tenant =
    housingContracts.find((lease) => lease.leaseId === inspectionLeaseId) ??
    null

  // New tenant is the latest non-ended housing contract (if different from tenant)
  let newTenant: Lease | null = null
  if (tenant) {
    const activeContracts = housingContracts.filter(
      (lease) =>
        lease.leaseId !== tenant.leaseId && lease.status !== LeaseStatus.Ended
    )
    newTenant =
      activeContracts.length > 0
        ? activeContracts[activeContracts.length - 1]
        : null
  }

  return { newTenant, tenant }
}

/**
 * Sends inspection protocol PDF to tenant contacts.
 *
 * @param inspection - The inspection details
 * @param pdfBuffer - The PDF protocol as a Buffer
 * @param contract - The lease contract with tenant contacts
 * @param recipientType - Type of recipient (new-tenant or tenant)
 * @returns Object with success status and details of sent emails
 */
export const sendProtocolToTenants = async (
  inspection: DetailedInspection,
  pdfBuffer: Buffer,
  contract: Lease,
  recipientType: 'new-tenant' | 'tenant'
): Promise<{
  success: boolean
  emails: string[]
  contactNames: string[]
  contractId: string
  error?: string
}> => {
  try {
    // Validate contract has tenants with email addresses
    if (!contract.tenants || contract.tenants.length === 0) {
      return {
        success: false,
        emails: [],
        contactNames: [],
        contractId: contract.leaseId,
        error: 'No tenant contacts found on contract',
      }
    }

    const tenantsWithEmail = contract.tenants.filter(
      (tenant) => tenant.emailAddress
    )

    if (tenantsWithEmail.length === 0) {
      return {
        success: false,
        emails: [],
        contactNames: [],
        contractId: contract.leaseId,
        error: 'No email addresses found for tenant',
      }
    }

    const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
    const formattedDate = dateFormatter.format(new Date(inspection.date))

    // Create attachment (convert Buffer to base64 string)
    const attachment: EmailAttachment = {
      filename: `Besiktningsprotokoll_${inspection.apartmentCode}_${inspection.id}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
    }

    // Send to all tenant contacts
    const sentEmails: string[] = []
    const sentContactNames: string[] = []
    const errors: string[] = []

    for (const tenant of tenantsWithEmail) {
      const email: InspectionProtocolEmail = {
        to: tenant.emailAddress!,
        subject: `Besiktningsprotokoll - ${inspection.type} ${inspection.address}`,
        text: `Besiktningsprotokoll för ${inspection.address}`,
        address: inspection.address,
        inspectionType: inspection.type,
        inspectionDate: formattedDate,
        apartmentCode: inspection.apartmentCode,
        attachments: [attachment],
      }

      const result =
        await communicationAdapter.sendInspectionProtocolEmail(email)

      if (result.ok) {
        sentEmails.push(tenant.emailAddress!)
        sentContactNames.push(tenant.fullName)
        logger.info(
          {
            inspectionId: inspection.id,
            contactCode: tenant.contactCode,
            email: tenant.emailAddress,
            recipientType,
          },
          'Sent inspection protocol to tenant'
        )
      } else {
        logger.error(
          {
            error: result.err,
            inspectionId: inspection.id,
            contactCode: tenant.contactCode,
            email: tenant.emailAddress,
          },
          'Error sending protocol to tenant'
        )
        errors.push(
          `Failed to send to ${tenant.fullName} (${tenant.emailAddress})`
        )
      }
    }

    // Return success if at least one email was sent
    if (sentEmails.length > 0) {
      return {
        success: true,
        emails: sentEmails,
        contactNames: sentContactNames,
        contractId: contract.leaseId,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      }
    } else {
      return {
        success: false,
        emails: [],
        contactNames: [],
        contractId: contract.leaseId,
        error: errors.join('; '),
      }
    }
  } catch (error) {
    logger.error(
      { error, inspectionId: inspection.id, contractId: contract.leaseId },
      'Error in sendProtocolToTenants'
    )
    return {
      success: false,
      emails: [],
      contactNames: [],
      contractId: contract.leaseId,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
