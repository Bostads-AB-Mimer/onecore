import axios, { AxiosStatic } from 'axios'

interface AxiosMock extends AxiosStatic {
  mockResolvedValue: Function
  mockRejectedValue: Function
}

jest.mock('axios')
import * as leasingAdapter from '../leasing-adapter'
import {
  mockedInvoices,
  mockedOldProblematicInvoices,
  mockedProblematicInvoices,
} from './leasing-adapter.mocks'
const mockAxios = axios as AxiosMock

describe('leasing-adapter', () => {
  describe('getInternalCreditInformation', () => {
    it('returns true if no problematic invoices', async () => {
      mockAxios.mockResolvedValue({
        data: { data: mockedInvoices },
      })

      const result = await leasingAdapter.getInternalCreditInformation(
        'P123456'
      )

      expect(result).toBe(true)
    })

    it('returns false if current problematic invoices', async () => {
      mockAxios.mockResolvedValue({
        data: { data: mockedProblematicInvoices },
      })

      const result = await leasingAdapter.getInternalCreditInformation(
        'P123456'
      )

      expect(result).toBe(false)
    })

    it('returns true if old problematic invoices', async () => {
      mockAxios.mockResolvedValue({
        data: { data: mockedOldProblematicInvoices },
      })

      const result = await leasingAdapter.getInternalCreditInformation(
        'P123456'
      )

      expect(result).toBe(true)
    })
  })
})
