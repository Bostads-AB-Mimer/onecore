import { Factory } from 'fishery'
import {
  TenfastInvoiceRow,
  TenfastRentalObject,
  TenfastRentalObjectByRentalObjectCodeResponse,
  toYearMonthString,
} from '../../adapters/tenfast/schemas'

export const TenfastRentalObjectByRentalObjectCodeResponseFactory =
  Factory.define<TenfastRentalObjectByRentalObjectCodeResponse>(
    ({ sequence }) => ({
      records: [
        {
          _id: '67eb8af5545c8f1195bef2e6' + sequence,
          hyra: 287.17,
          hyraVat: 0, // total moms pa hyran
          hyraExcludingVat: 287.17, // hyran exklusive moms
          hyror: TenfastInvoiceRowFactory.buildList(3),
          externalId: `externalId-${sequence}`,
          contractTemplate: 'template-001',
        },
      ],
      prev: null,
      next: null,
      totalCount: 1,
    })
  )

export const TenfastRentalObjectFactory = Factory.define<TenfastRentalObject>(
  ({ sequence }) => ({
    _id: `rental-object-${sequence}`,
    hyra: 287.17,
    hyraVat: 0,
    hyraExcludingVat: 287.17,
    hyror: [TenfastInvoiceRowFactory.build()],
    externalId: 'externalId-1',
    contractTemplate: 'template-001',
  })
)

export const TenfastInvoiceRowFactory = Factory.define<TenfastInvoiceRow>(
  ({ sequence }) => ({
    amount: 115,
    vat: 0.25,
    from: toYearMonthString(new Date('2013-03')),
    article: '12334567' + sequence,
    label: 'Hyra p-plats',
    _id: sequence.toString(),
  })
)
