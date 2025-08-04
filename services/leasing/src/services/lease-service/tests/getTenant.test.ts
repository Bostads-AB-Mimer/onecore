import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease } from 'onecore-types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as xpandSoapAdapter from '../adapters/xpand/xpand-soap-adapter'
import * as estateCodeAdapter from '../adapters/xpand/estate-code-adapter'
import * as priorityListService from '../priority-list-service'
import { leaseTypes } from '../../../constants/leaseTypes'
import * as factory from './factories'
import { getTenant } from '../get-tenant'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

// Mock until this bug is fixed: https://github.com/kulshekhar/ts-jest/issues/3397
const LeaseStatus = {
  Current: 0,
}

describe('getTenant', () => {
  it("returns no-valid-housing-contract if contact doesn't have a current or upcoming housing contract", async () => {
    const lease = factory.lease.build({
      type: leaseTypes.housingContract,
      leaseStartDate: new Date('2021-01-01'),
      leaseEndDate: new Date('2022-01-01'),
    })
    const contact = factory.contact.build()
    const residentialArea = { code: '1', caption: 'ett' }

    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: contact,
      })

    jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
      .mockResolvedValueOnce({ ok: true, data: [lease] })

    jest
      .spyOn(tenantLeaseAdapter, 'getResidentialAreaByRentalPropertyId')
      .mockResolvedValueOnce({
        ok: true,
        data: residentialArea,
      })

    jest
      .spyOn(priorityListService, 'parseLeasesForHousingContracts')
      .mockImplementationOnce(() => [undefined, undefined])

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({
        estateCode: 'an estate code',
        type: 'a type',
      })

    const result = await getTenant({ contactCode: '123' })

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.err).toBe('no-valid-housing-contract')
    }
  })
})
