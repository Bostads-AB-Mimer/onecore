import assert from 'node:assert'
import nock from 'nock'
import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

import * as factory from '../../../../test/factories'

describe('rental-objects adapter', () => {
  describe(leasingAdapter.getRentalObjectAvailabilityByCode, () => {
    it('should return availability info when rentalObjectCode exists', async () => {
      //Arrange
      const availabilityInfo = factory.rentalObjectAvailabilityInfo.build({
        rentalObjectCode: '123-456-789',
      })

      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123-456-789\/availability/)
        .reply(200, { content: availabilityInfo })

      //Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilityByCode('123-456-789')
      assert(result.ok)

      //Assert
      expect(result.data).toEqual(
        expect.objectContaining({ rentalObjectCode: '123-456-789' })
      )
    })

    it('should return availability-not-found when rentalObjectCode does not exist', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/not-found-code\/availability/)
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilityByCode('not-found-code')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('availability-not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123\/availability/)
        .replyWithError('Network error')

      // Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilityByCode('123')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('unknown')
    })

    it('should log error when rentalObjectCode is not found', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(
        require('@onecore/utilities').logger,
        'error'
      )
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/not-found-code\/availability/)
        .reply(404)

      // Act
      await leasingAdapter.getRentalObjectAvailabilityByCode('not-found-code')

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        { rentalObjectCode: 'not-found-code' },
        'Rental object availability not found for code:'
      )
      loggerSpy.mockRestore()
    })

    it('should log error on unknown error', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(
        require('@onecore/utilities').logger,
        'error'
      )
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/network-error\/availability/)
        .replyWithError('Network error')

      // Act
      await leasingAdapter.getRentalObjectAvailabilityByCode('network-error')

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(
          'Error retrieving rental object availability by code: network-error'
        )
      )
      loggerSpy.mockRestore()
    })
  })

  describe(leasingAdapter.getRentalObjectAvailabilities, () => {
    it('should return availabilities for all provided rentalObjectCodes', async () => {
      // Arrange
      const rentalObjectCodes = ['code-1', 'code-2']
      const availabilities = [1000, 2000]
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/availabilities', { rentalObjectCodes })
        .reply(200, { content: availabilities })

      // Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilities(rentalObjectCodes)

      // Assert
      assert(result.ok)
      expect(result.data).toEqual(availabilities)
    })

    it('should return availabilities-not-found when no availabilities are found', async () => {
      // Arrange
      const rentalObjectCodes = ['not-found-1', 'not-found-2']
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/availabilities', { rentalObjectCodes })
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilities(rentalObjectCodes)

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('availabilities-not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      const rentalObjectCodes = ['code-1', 'code-2']
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/availabilities', { rentalObjectCodes })
        .replyWithError('Network error')

      // Act
      const result =
        await leasingAdapter.getRentalObjectAvailabilities(rentalObjectCodes)

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('unknown')
    })

    it('should log error when availabilities are not found', async () => {
      // Arrange
      const rentalObjectCodes = ['not-found-1', 'not-found-2']
      const loggerSpy = jest.spyOn(
        require('@onecore/utilities').logger,
        'error'
      )
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/availabilities', { rentalObjectCodes })
        .reply(404)

      // Act
      await leasingAdapter.getRentalObjectAvailabilities(rentalObjectCodes)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        { rentalObjectCodes },
        'Rental object availabilities not found for codes:'
      )
      loggerSpy.mockRestore()
    })

    it('should log error on unknown error', async () => {
      // Arrange
      const rentalObjectCodes = ['code-1', 'code-2']
      const loggerSpy = jest.spyOn(
        require('@onecore/utilities').logger,
        'error'
      )
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/availabilities', { rentalObjectCodes })
        .replyWithError('Network error')

      // Act
      await leasingAdapter.getRentalObjectAvailabilities(rentalObjectCodes)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(
          'Error retrieving rental object availabilities by codes:'
        )
      )
      loggerSpy.mockRestore()
    })
  })

  describe(leasingAdapter.getRentalObjectRentByCode, () => {
    it('should return rent when rentalObjectCode exists', async () => {
      // Arrange
      const rent = factory.rentalObjectRent.build()
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123-456-789\/rent$/)
        .reply(200, { content: { rentalObjectCode: '123-456-789', rent } })

      // Act
      const result =
        await leasingAdapter.getRentalObjectRentByCode('123-456-789')

      // Assert
      assert(result.ok)
      expect(result.data).toEqual({
        rentalObjectCode: '123-456-789',
        rent: expect.objectContaining({ amount: rent.amount }),
      })
    })

    it('should return not-found when rentalObjectCode does not exist', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/not-found-code\/rent$/)
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectRentByCode('not-found-code')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123\/rent$/)
        .replyWithError('Network error')

      // Act
      const result = await leasingAdapter.getRentalObjectRentByCode('123')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('unknown')
    })
  })

  describe(leasingAdapter.getRentalObjectLegacyRentByCode, () => {
    it('should return rent when rentalObjectCode exists', async () => {
      // Arrange
      const rent = factory.rentalObjectRent.build()
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123-456-789\/rent-legacy/)
        .reply(200, { content: { rentalObjectCode: '123-456-789', rent } })

      // Act
      const result =
        await leasingAdapter.getRentalObjectLegacyRentByCode('123-456-789')

      // Assert
      assert(result.ok)
      expect(result.data).toEqual({
        rentalObjectCode: '123-456-789',
        rent: expect.objectContaining({ amount: rent.amount }),
      })
    })

    it('should return not-found when no rent rows exist', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/not-found-code\/rent-legacy/)
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectLegacyRentByCode('not-found-code')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123\/rent-legacy/)
        .replyWithError('Network error')

      // Act
      const result = await leasingAdapter.getRentalObjectLegacyRentByCode('123')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('unknown')
    })
  })

  describe(leasingAdapter.getApartmentByCode, () => {
    it('returns the apartment', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/apartments/by-code/211-001-01-0101')
        .reply(200, {
          content: factory.rentalObject.build({
            rentalObjectCode: '211-001-01-0101',
          }),
        })

      const result = await leasingAdapter.getApartmentByCode('211-001-01-0101')

      assert(result.ok)
      expect(result.data.rentalObjectCode).toBe('211-001-01-0101')
    })

    it.each([
      [404, 'not-found'],
      [500, 'unknown'],
    ])('maps %i to %s', async (status, err) => {
      nock(config.tenantsLeasesService.url)
        .get('/apartments/by-code/211-001-01-0101')
        .reply(status)

      const result = await leasingAdapter.getApartmentByCode('211-001-01-0101')

      expect(result).toEqual({ ok: false, err })
    })
  })

  describe(leasingAdapter.getApartments, () => {
    it('posts the codes and returns the apartments', async () => {
      const scope = nock(config.tenantsLeasesService.url)
        .post('/apartments', { rentalObjectCodes: ['A', 'B'] })
        .reply(200, {
          content: [
            factory.rentalObject.build({ rentalObjectCode: 'A' }),
            factory.rentalObject.build({ rentalObjectCode: 'B' }),
          ],
        })

      const result = await leasingAdapter.getApartments(['A', 'B'])

      assert(result.ok)
      expect(result.data.map((a) => a.rentalObjectCode)).toEqual(['A', 'B'])
      scope.done()
    })

    it.each([
      [404, 'not-found'],
      [500, 'unknown'],
    ])('maps %i to %s', async (status, err) => {
      nock(config.tenantsLeasesService.url).post('/apartments').reply(status)

      const result = await leasingAdapter.getApartments(['A'])

      expect(result).toEqual({ ok: false, err })
    })
  })

  // getRentalObjectsForListings relies on a 404 meaning not-found, not unknown
  describe('parking space lookups on 404', () => {
    it('getParkingSpaceByCode returns not-found', async () => {
      nock(config.tenantsLeasesService.url)
        .get('/parking-spaces/by-code/P1')
        .reply(404)

      const result = await leasingAdapter.getParkingSpaceByCode('P1')

      expect(result).toEqual({ ok: false, err: 'not-found' })
    })

    it('getParkingSpaces returns not-found', async () => {
      nock(config.tenantsLeasesService.url).post('/parking-spaces').reply(404)

      const result = await leasingAdapter.getParkingSpaces(['P1'])

      expect(result).toEqual({ ok: false, err: 'not-found' })
    })
  })
})
