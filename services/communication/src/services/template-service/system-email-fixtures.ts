import type {
  InspectionProtocolEmail,
  InvoiceNotificationEmail,
  LeaseTerminationConfirmationEmail,
  NonScoredParkingSpaceApprovedEmail,
  NonScoredParkingSpaceDeniedEmail,
  ParkingSpaceAcceptOfferEmail,
  ParkingSpaceOfferEmail,
  WorkOrderEmail,
} from '@onecore/types'

import {
  buildAcceptOfferPlaceholders,
  buildInspectionProtocolPlaceholders,
  buildInvoiceNotificationPlaceholders,
  buildNonScoredApprovedPlaceholders,
  buildNonScoredDeniedPlaceholders,
  buildParkingSpaceOfferPlaceholders,
  buildWorkOrderPlaceholders,
} from '../infobip-service/adapters/email-adapter'
import { buildLeaseTerminationPlaceholders } from '../infobip-service/adapters/lease-termination-placeholders'
import type { Placeholders } from './render/render'
import type { SystemTemplateKey } from './system-templates'

// Realistic request payloads, run through the same builders the send
// functions use, so previews and tests show exactly what a tenant gets.
const offer: ParkingSpaceOfferEmail = {
  to: 'tenant@example.com',
  subject: 'x',
  text: 'x',
  contactCode: 'P123456',
  address: 'Bilvägen 3',
  firstName: 'Åsa',
  availableFrom: '2026-12-01',
  deadlineDate: '2026-11-30',
  rent: '450',
  type: 'Carport',
  parkingSpaceId: '705-022-04-0201',
  objectId: 'P1',
  applicationType: 'Replace',
  offerURL: 'https://www.mimer.nu/mina-sidor/erbjudanden/1',
}

const accept: ParkingSpaceAcceptOfferEmail = {
  to: offer.to,
  subject: 'x',
  text: 'x',
  contactCode: offer.contactCode,
  address: offer.address,
  firstName: offer.firstName,
  availableFrom: offer.availableFrom,
  rent: offer.rent,
  type: offer.type,
  parkingSpaceId: offer.parkingSpaceId,
  objectId: offer.objectId,
}

const denied: NonScoredParkingSpaceDeniedEmail = {
  to: offer.to,
  subject: 'x',
  text: 'x',
  contactCode: offer.contactCode,
  address: offer.address,
  availableFrom: offer.availableFrom,
  parkingSpaceId: offer.parkingSpaceId,
  objectId: offer.objectId,
  type: offer.type,
  rent: offer.rent,
}

const approved: NonScoredParkingSpaceApprovedEmail = {
  ...denied,
  leaseId: '705-022-04-0201/01',
}

// Odoo sends work order messages as HTML.
const workOrder: WorkOrderEmail = {
  to: offer.to,
  subject: 'x',
  text: '<p>Hej Åsa!</p><p>Vi kommer och byter packningen i köket på <strong>torsdag mellan 8 och 12</strong>.<br>Ring oss om tiden inte passar.</p>',
}

const invoice: InvoiceNotificationEmail = {
  to: offer.to,
  firstName: 'Åsa',
  address: 'Bilvägen 3',
  invoiceNumber: '55012345',
  dueDate: '2026-12-31',
  totalAmount: '450',
}

const inspection: InspectionProtocolEmail = {
  to: offer.to,
  subject: 'x',
  text: 'x',
  firstName: 'Åsa',
}

const leaseTermination: LeaseTerminationConfirmationEmail = {
  to: offer.to,
  contactCode: offer.contactCode,
  firstName: 'Åsa',
  lastName: 'Öberg',
  leaseId: '705-022-04-0201/01',
  endDate: new Date('2027-01-31'),
  preferredMoveOutDate: '2027-01-15',
  rentalObjectAddress: 'Bilvägen 3',
  rentalType: 'Bilplats',
  tenants: [
    {
      contactCode: offer.contactCode,
      fullName: 'Åsa Öberg',
      birthDate: '1985-03-14',
      street: 'Storgatan 1',
      zipCode: '722 11',
      city: 'Västerås',
    },
    {
      contactCode: 'P654321',
      fullName: 'Per Öberg',
      birthDate: '1983-08-02',
      street: 'Storgatan 1',
      zipCode: '722 11',
      city: 'Västerås',
    },
  ],
}

export const SYSTEM_EMAIL_FIXTURES: Record<SystemTemplateKey, Placeholders> = {
  parking_space_offer_additional: buildParkingSpaceOfferPlaceholders({
    ...offer,
    applicationType: 'Additional',
  }),
  parking_space_offer_replace: buildParkingSpaceOfferPlaceholders(offer),
  parking_space_accept_offer: buildAcceptOfferPlaceholders(accept),
  non_scored_parking_space_approved:
    buildNonScoredApprovedPlaceholders(approved),
  non_scored_parking_space_denied: buildNonScoredDeniedPlaceholders(denied),
  work_order: buildWorkOrderPlaceholders(workOrder),
  work_order_external_contractor: buildWorkOrderPlaceholders({
    ...workOrder,
    text: '<p>Hej!</p><p>Vi kommer på torsdag förmiddag för att åtgärda ventilationen.</p>',
    externalContractorName: 'Västerås Ventilation AB',
  }),
  invoice_notification: buildInvoiceNotificationPlaceholders(invoice),
  inspection_protocol: buildInspectionProtocolPlaceholders(inspection),
  lease_termination_confirmation:
    buildLeaseTerminationPlaceholders(leaseTermination),
}
