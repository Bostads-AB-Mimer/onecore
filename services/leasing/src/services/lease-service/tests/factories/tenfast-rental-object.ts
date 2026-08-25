import { Factory } from 'fishery'
import {
  TenfastInvoiceRow,
  TenfastRentalObject,
  toYearMonthDayString,
} from '../../adapters/tenfast/schemas'

export const TenfastRentalObjectFactory = Factory.define<TenfastRentalObject>(
  ({ sequence }) => ({
    _id: `rental-object-${sequence}`,
    hyra: 287.17,
    hyraVat: 0,
    hyraExcludingVat: 287.17,
    hyror: [TenfastInvoiceRowFactory.build()],
    externalId: 'externalId-1',
    contractTemplate: 'template-001',
    category: { code: 'Bilplats', label: 'Bilplats' },
    tags: [],
    avtal: [],
  })
)

export const TenfastInvoiceRowFactory = Factory.define<TenfastInvoiceRow>(
  ({ sequence }) => ({
    amount: 115,
    vat: 0.25,
    from: toYearMonthDayString(new Date('2013-03-01')),
    article: '12334567' + sequence,
    label: 'Hyra p-plats',
    _id: sequence.toString(),
  })
)
