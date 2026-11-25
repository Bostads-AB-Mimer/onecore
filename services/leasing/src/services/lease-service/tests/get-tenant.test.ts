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

  it('keeps a terminated housing lease as current until its end date, although the notice was handled earlier', async () => {
    const day = 24 * 60 * 60 * 1000
    const contact = factory.contact.build()

    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contact })

    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.tenfastTenant.build() })

    jest.spyOn(tenfastAdapter, 'getLeasesByTenantId').mockResolvedValueOnce({
      ok: true,
      data: [
        factory.tenfastLease.build({
          externalId: '211-131-01-0404/02',
          stage: 'terminationScheduled',
          startDate: new Date('2023-06-01'),
          endDate: new Date(Date.now() + 60 * day),
          cancellation: {
            cancelled: false,
            requested: true,
            doneAutomatically: false,
            receivedCancellationAt: new Date(Date.now() - 33 * day),
            notifiedAt: null,
            // The day Tenfast handled the notice, months before the lease ends.
            handledAt: new Date(Date.now() - 30 * day),
            handledBy: null,
            preferredMoveOutDate: null,
            cancelledByType: 'hyresgast',
          },
          hyresobjekt: [factory.tenfastRentalObject.build({ typ: 'bostad' })],
        }),
      ],
    })

    jest
      .spyOn(tenantLeaseAdapter, 'getResidentialAreaByRentalPropertyId')
      .mockResolvedValueOnce({
        ok: true,
        data: { code: 'BÄC', caption: 'Bäckby' },
      })

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({ estateCode: 'an estate code', type: 'a type' })

    const result = await getTenant({ contactCode: contact.contactCode })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.currentHousingContract?.leaseId).toBe(
      '211-131-01-0404/02'
    )
    expect(result.data.currentHousingContract?.residentialArea?.code).toBe(
      'BÄC'
    )
    expect(result.data.isAboutToLeave).toBe(true)
  })
})
