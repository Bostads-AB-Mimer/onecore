import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Lease } from 'onecore-types'

import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/tenant-lease-adapter'
import * as xpandSoapAdapter from '../adapters/xpand-soap-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  let leaseMock: Array<Lease>

  // Mock until this bug is fixed: https://github.com/kulshekhar/ts-jest/issues/3397
  const LeaseStatus = {
    Active: 0,
  }

  beforeEach(() => {
    leaseMock = [
      {
        leaseId: '406-097-11-0201/06',
        leaseNumber: '',
        leaseStartDate: new Date('2023-09-07T00:00:00.000Z'),
        leaseEndDate: undefined,
        status: LeaseStatus.Active,
        tenantContactIds: ['P174958'],
        tenants: [
          {
            contactId: 'P174958',
            firstName: 'Kalle',
            lastName: 'Testsson',
            fullName: 'Testsson Kalle',
            type: 'Kontraktsinnehavare',
            leaseId: '406-097-11-0201/06',
            nationalRegistrationNumber: '200009092388',
            birthDate: new Date('2000-09-09T00:00:00.000Z'),
            address: {
              street: 'Bovägen',
              number: '12',
              postalCode: '12345',
              city: 'Westeros',
            },
            mobilePhone: '070-123123123',
            phoneNumber: '010-120120',
            emailAddress: 'kalle.testsson@test.se',
            lastUpdated: new Date('2023-09-11T07:55:48.750Z'),
            lease: undefined,
          },
        ],
        rentalPropertyId: '406-097-11-0201',
        type: 'Bostadskontrakt',
        lastUpdated: new Date('2023-09-11T07:45:09.833Z'),
        rentalProperty: undefined,
        rentInfo: undefined,
      },
      {
        leaseId: '102-008-03-0202/07',
        leaseNumber: '',
        leaseStartDate: new Date('2010-12-01T00:00:00.000Z'),
        leaseEndDate: undefined,
        status: LeaseStatus.Active,
        tenantContactIds: ['P965338'],
        tenants: [
          {
            contactId: 'P965338',
            firstName: 'Maj-Britt',
            lastName: 'Lundberg',
            fullName: 'Maj-Britt Lundberg',
            type: 'Kontraktsinnehavare',
            leaseId: '102-008-03-0202/07',
            nationalRegistrationNumber: '194808075577',
            birthDate: new Date('1948-08-07T00:00:00.000Z'),
            address: {
              street: 'Gatvägen',
              number: '56',
              postalCode: '72266',
              city: 'Västerås',
            },
            mobilePhone: '+460759429414',
            phoneNumber: '+465292643751',
            emailAddress: 'majbritt-123@mimer.nu',
            lastUpdated: undefined,
            lease: undefined,
          },
        ],
        rentalPropertyId: '102-008-03-0202',
        type: 'Bostadskontrakt',
        lastUpdated: undefined,
        rentalProperty: undefined,
        rentInfo: undefined,
      },
      {
        leaseId: '102-008-03-0202/07',
        leaseNumber: '',
        leaseStartDate: new Date('2010-12-01T00:00:00.000Z'),
        leaseEndDate: undefined,
        status: LeaseStatus.Active,
        tenantContactIds: ['P965339'],
        tenants: [
          {
            contactId: 'P965339',
            firstName: 'Erik',
            lastName: 'Lundberg',
            fullName: 'Erik Lundberg',
            type: 'Kontraktsinnehavare',
            leaseId: '102-008-03-0202/07',
            nationalRegistrationNumber: '194512121122',
            birthDate: new Date('1945-12-12T00:00:00.000Z'),
            address: {
              street: 'Gatvägen',
              number: '56',
              postalCode: '72266',
              city: 'Västerås',
            },
            mobilePhone: '+460759429414',
            phoneNumber: '+465292643751',
            emailAddress: 'erik.lundberg@mimer.nu',
            lastUpdated: undefined,
            lease: undefined,
          },
        ],
        rentalPropertyId: '102-008-03-0202',
        type: 'Bostadskontrakt',
        lastUpdated: undefined,
        rentalProperty: undefined,
        rentInfo: undefined,
      },
    ]
  })

  describe('GET /leases', () => {
    it('responds with an array of leases', async () => {
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValue(leaseMock)

      const res = await request(app.callback()).get('/leases')
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(res.body.data.length).toBe(3)
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with a lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock[0])

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()

      expect(res.body.data.leaseId).toEqual('406-097-11-0201/06')
    })
  })

  describe('POST /leases', () => {
    it('calls xpand adapter and returns id of new lease', async () => {
      const xpandAdapterSpy = jest
        .spyOn(xpandSoapAdapter, 'createLease')
        .mockResolvedValue('123-123-123/1')

      const result = await request(app.callback()).post('/leases')

      expect(xpandAdapterSpy).toHaveBeenCalled()
      expect(result.body).toEqual({ LeaseId: '123-123-123/1' })
    })

    it('handles errors', async () => {
      const xpandAdapterSpy = jest
        .spyOn(xpandSoapAdapter, 'createLease')
        .mockImplementation(() => {
          throw new Error('Oh no')
        })

      const result = await request(app.callback()).post('/leases')

      expect(xpandAdapterSpy).toHaveBeenCalled

      expect(result.body).toEqual({ error: 'Oh no' })
    })
  })
})
