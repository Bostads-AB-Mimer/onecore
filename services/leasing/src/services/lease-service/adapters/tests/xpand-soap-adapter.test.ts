import { createLease } from '../strong-soap-xpand-soap-adapter'
import { Lease, LeaseStatus } from '../../../../common/types'

// jest.useFakeTimers()

describe('xpand-soap-adapter', () => {
  describe('createLease', () => {
    it.only('is a work in progress', async () => {
      await createLease(new Date(2024, 10, 1), '504-714-00-0008', 'P079586')

      console.log('test')
    })

    it.todo('makes a request to the soap api')
  })
})
