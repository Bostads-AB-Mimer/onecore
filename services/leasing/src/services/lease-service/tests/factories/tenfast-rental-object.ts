import { Factory } from 'fishery'
import {
  TenfastInvoiceRow,
  TenfastRentalObjectByRentalObjectCodeResponse,
} from '../../../../common/adapters/tenfast/schemas'

export const TenfastRentalObjectByRentalObjectCodeResponseSchemaFactory =
  Factory.define<TenfastRentalObjectByRentalObjectCodeResponse>(
    ({ sequence }) => ({
      records: [
        {
          _id: '67eb8af5545c8f1195bef2e6' + sequence,
          hyra: 287.17,
          hyraVat: 0, // total moms pa hyran
          hyraExcludingVat: 287.17, // hyran exklusive moms
          hyror: TenfastInvoiceRowSchemaFactory.buildList(3),
          externalId: `externalId-${sequence}`,
        },
      ],
      prev: null,
      next: null,
      totalCount: 1,
    })
  )

export const TenfastInvoiceRowSchemaFactory = Factory.define<TenfastInvoiceRow>(
  ({ sequence }) => ({
    amount: 115,
    vat: 0.25,
    from: '2013-03',
    article: '12334567' + sequence,
    label: 'Hyra p-plats',
    _id: sequence.toString(),
  })
)
