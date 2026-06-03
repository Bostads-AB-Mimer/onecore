import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/xpand/tenant-lease-adapter'
import * as estateCodeAdapter from '../adapters/xpand/estate-code-adapter'
import * as priorityListService from '../priority-list-service'
import { leaseTypes } from '../../../constants/leaseTypes'
import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import * as factory from './factories'
import { getTenant } from '../get-tenant'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe(getTenant, () => {
  it("returns no-valid-housing-contract if contact doesn't have a current or upcoming housing contract", async () => {
    const contact = factory.contact.build()
    const residentialArea = { code: '1', caption: 'ett' }

    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: contact,
      })

    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.tenfastTenant.build() })

    jest.spyOn(tenfastAdapter, 'getLeasesByTenantId').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.tenfastLease.build({
          hyresobjekt: [
            factory.tenfastRentalObject.build({
              typ: leaseTypes.housingContract,
            }),
          ],
        }),
      ],
    })

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
