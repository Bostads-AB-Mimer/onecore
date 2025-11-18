import { Factory } from 'fishery'
import { TenfastRentalObjectByRentalObjectCodeResponse } from '../../../../common/adapters/tenfast/schemas'

export const TenfastRentalObjectByRentalObjectCodeResponseSchemaFactory =
  Factory.define<TenfastRentalObjectByRentalObjectCodeResponse>(
    ({ sequence }) => ({
      records: [
        {
          _id: '67eb8af5545c8f1195bef2e6',
          hyra: 287.17,
          hyror: [],
          article: '67eb8aea545c8f1195bea0ba',
        },
      ],
      prev: null,
      next: null,
      totalCount: 1,
    })
  )
