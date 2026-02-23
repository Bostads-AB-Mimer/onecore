import assert from 'node:assert'
import nock from 'nock'
import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

import * as factory from '../../../../test/factories'

describe('rental-objects adapter', () => {
  describe(leasingAdapter.getRentalObjectRentByCode, () => {
    it('should return rent when rentalObjectCode exists', async () => {
      //Arrange
      const rent = factory.rentalObjectRent.build({
        rentalObjectCode: '123-456-789',
      })

      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123-456-789\/rent/)
        .reply(200, { content: rent })

      //Act
      const result =
        await leasingAdapter.getRentalObjectRentByCode('123-456-789')
      assert(result.ok)

      //Assert
      expect(result.data).toEqual(
        expect.objectContaining({ rentalObjectCode: '123-456-789' })
      )
    })

    it('should return rent-not-found when rentalObjectCode does not exist', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/not-found-code\/rent/)
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectRentByCode('not-found-code')

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('rent-not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      nock(config.tenantsLeasesService.url)
        .get(/rental-objects\/by-code\/123\/rent/)
        .replyWithError('Network error')

      // Act
      const result = await leasingAdapter.getRentalObjectRentByCode('123')

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
        .get(/rental-objects\/by-code\/not-found-code\/rent/)
        .reply(404)

      // Act
      await leasingAdapter.getRentalObjectRentByCode('not-found-code')

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        { rentalObjectCode: 'not-found-code' },
        'Rental object rent not found for code:'
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
        .get(/rental-objects\/by-code\/network-error\/rent/)
        .replyWithError('Network error')

      // Act
      await leasingAdapter.getRentalObjectRentByCode('network-error')

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(
          'Error retrieving rental object rent by code: network-error'
        )
      )
      loggerSpy.mockRestore()
    })
  })

  describe(leasingAdapter.getRentalObjectRents, () => {
    it('should return rents for all provided rentalObjectCodes', async () => {
      // Arrange
      const rentalObjectCodes = ['code-1', 'code-2']
      const rents = [1000, 2000]
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/rent', { rentalObjectCodes })
        .reply(200, { content: rents })

      // Act
      const result =
        await leasingAdapter.getRentalObjectRents(rentalObjectCodes)

      // Assert
      assert(result.ok)
      expect(result.data).toEqual(rents)
    })

    it('should return rents-not-found when no rents are found', async () => {
      // Arrange
      const rentalObjectCodes = ['not-found-1', 'not-found-2']
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/rent', { rentalObjectCodes })
        .reply(404)

      // Act
      const result =
        await leasingAdapter.getRentalObjectRents(rentalObjectCodes)

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('rents-not-found')
    })

    it('should return unknown on network error', async () => {
      // Arrange
      const rentalObjectCodes = ['code-1', 'code-2']
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/rent', { rentalObjectCodes })
        .replyWithError('Network error')

      // Act
      const result =
        await leasingAdapter.getRentalObjectRents(rentalObjectCodes)

      // Assert
      assert(!result.ok)
      expect(result.err).toBe('unknown')
    })

    it('should log error when rents are not found', async () => {
      // Arrange
      const rentalObjectCodes = ['not-found-1', 'not-found-2']
      const loggerSpy = jest.spyOn(
        require('@onecore/utilities').logger,
        'error'
      )
      nock(config.tenantsLeasesService.url)
        .post('/rental-objects/rent', { rentalObjectCodes })
        .reply(404)

      // Act
      await leasingAdapter.getRentalObjectRents(rentalObjectCodes)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        { rentalObjectCodes },
        'Rental object rent not found for codes:'
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
        .post('/rental-objects/rent', { rentalObjectCodes })
        .replyWithError('Network error')

      // Act
      await leasingAdapter.getRentalObjectRents(rentalObjectCodes)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Error retrieving rental object rent by codes:')
      )
      loggerSpy.mockRestore()
    })
  })
})
