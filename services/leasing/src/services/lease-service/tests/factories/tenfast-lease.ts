import { Factory } from 'fishery'

import { TenfastLease } from '../../adapters/tenfast/schemas'
import { TenfastRentalObjectFactory } from './tenfast-rental-object'

export const TenfastLeaseFactory = Factory.define<TenfastLease>(
  ({ sequence }) => ({
    externalId: `externalId-${sequence}`,
    reference: sequence,
    version: 1,
    originalData: {},
    hyror: [],
    simpleHyra: false,
    startDate: new Date(),
    endDate: null,
    aviseringsTyp: 'email',
    uppsagningstid: '3 månader',
    aviseringsFrekvens: 'månad',
    forskottAvisering: 'nej',
    betalningsOffset: '0',
    betalasForskott: false,
    vatEnabled: false,
    method: 'digital',
    file: {
      key: `file-key-${sequence}`,
      location: 'https://files.example.com/file.pdf',
      originalName: 'file.pdf',
    },
    bankidSigningEnabled: false,
    bankidSignatures: [],
    cancellation: {
      cancelled: false,
      doneAutomatically: false,
      receivedCancellationAt: null,
      notifiedAt: null,
      handledAt: null,
      handledBy: null,
      preferredMoveOutDate: null,
    },
    deposit: {
      ekoNotifications: [],
    },
    id: `lease-${sequence}`,
    _id: `lease-mongo-${sequence}`,
    hyresvard: 'hyresvard-1',
    hyresgaster: [],
    hyresobjekt: [TenfastRentalObjectFactory.build()],
    invitations: [],
    confirmedHyresgastInfo: [],
    acceptedByHyresgast: false,
    comments: [],
    files: [],
    versions: {},
    updatedBy: `user-${sequence}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    startInvoicingFrom: new Date(),
    signedAt: new Date(),
    tags: [],
  })
)
