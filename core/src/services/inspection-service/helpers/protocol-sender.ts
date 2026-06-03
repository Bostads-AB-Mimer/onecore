import { logger } from '@onecore/utilities'

import * as leasingAdapter from '../../../adapters/leasing-adapter'
import type { DetailedInspection, SendProtocolResponse } from '../schemas'
import { identifyTenantContracts, sendProtocolToTenants } from './email-sender'
import { generateInspectionProtocolPdf } from './pdf-generator'

/**
 * Source-agnostic send-protocol pipeline.
 *
 * Returns a `{ status, body }` pair so the route handler stays a thin wrapper.
 * Each early-return path produces a structurally complete SendProtocolResponse
 * — never the literal recipient `'unknown'` (which CLAUDE.md forbids).
 */
export const sendProtocolForInspection = async (
  inspection: DetailedInspection,
  recipient: 'new-tenant' | 'tenant'
): Promise<{ status: number; body: SendProtocolResponse }> => {
  const leases = await leasingAdapter.getLeasesForPropertyId(
    inspection.residenceId,
    {
      includeContacts: true,
      includeUpcomingLeases: true,
      includeTerminatedLeases: true,
    }
  )

  const { newTenant, tenant } = identifyTenantContracts(
    leases,
    inspection.leaseId
  )

  const selectedContract = recipient === 'new-tenant' ? newTenant : tenant

  if (!selectedContract) {
    return {
      status: 400,
      body: {
        success: false,
        recipient,
        sentTo: { emails: [], contactNames: [], contractId: '' },
        error: `No contract found for ${recipient}`,
      },
    }
  }

  if (
    !selectedContract.tenants?.length ||
    !selectedContract.tenants.some((t) => t.emailAddress)
  ) {
    return {
      status: 400,
      body: {
        success: false,
        recipient,
        sentTo: {
          emails: [],
          contactNames: [],
          contractId: selectedContract.leaseId,
        },
        error: 'No email addresses found for tenant',
      },
    }
  }

  let pdfBuffer: Buffer
  try {
    // Incoming tenant gets a cost-free protocol; outgoing tenant sees costs.
    pdfBuffer = await generateInspectionProtocolPdf(inspection, {
      includeCosts: recipient !== 'new-tenant',
    })
  } catch (pdfError) {
    logger.error(
      { err: pdfError, inspectionId: inspection.id },
      'protocol-sender.generatePdf'
    )
    return {
      status: 500,
      body: {
        success: false,
        recipient,
        sentTo: {
          emails: [],
          contactNames: [],
          contractId: selectedContract.leaseId,
        },
        error: 'Failed to generate PDF protocol',
      },
    }
  }

  const result = await sendProtocolToTenants(
    inspection,
    pdfBuffer,
    selectedContract,
    recipient
  )

  return {
    status: 200,
    body: {
      success: result.success,
      recipient,
      sentTo: {
        emails: result.emails,
        contactNames: result.contactNames,
        contractId: result.contractId,
      },
      error: result.error,
    },
  }
}
