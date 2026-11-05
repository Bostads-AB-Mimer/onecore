import soapRequest from 'easy-soap-request'
import { WaitingListType } from '@onecore/types'

import {
  addApplicantToToWaitingList,
  removeApplicantFromWaitingList,
} from '../../../adapters/xpand/xpand-soap-adapter'

jest.mock('easy-soap-request')

const soapRequestMock = soapRequest as jest.MockedFunction<typeof soapRequest>

/** Minimal `ResultBase` envelope — the only part these adapters read. */
const resultBase = (success: boolean, message = '') => ({
  response: {
    body: `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
        <soap:Body>
          <ResultBase>
            <Success>${success}</Success>
            <Message>${message}</Message>
          </ResultBase>
        </soap:Body>
      </soap:Envelope>`,
    statusCode: 200,
    headers: {},
  },
})

/** The queue captions the adapter sent, in call order. */
const sentCaptions = () =>
  soapRequestMock.mock.calls.map(
    ([{ xml }]) =>
      xml.match(
        /<inc:WaitingListTypeCaption>(.*?)<\/inc:WaitingListTypeCaption>/
      )![1]
  )

beforeEach(() => {
  jest.resetAllMocks()
})

/**
 * A waiting-list type spans several Xpand captions, and a contact rarely holds
 * all of them. Both loops must therefore keep going past the benign "already
 * there" / "not there" answers — aborting would leave the remaining captions
 * untouched while the caller reports the operation as done. That is how a reset
 * could leave queue time intact after a contact had already won an offer.
 */
describe('waiting list captions', () => {
  describe(addApplicantToToWaitingList, () => {
    it('enrols in every caption of the type', async () => {
      soapRequestMock.mockResolvedValue(resultBase(true) as never)

      const result = await addApplicantToToWaitingList(
        'P123456',
        WaitingListType.Housing
      )

      expect(result).toEqual({ ok: true, data: undefined })
      expect(sentCaptions()).toEqual([
        'Bostad',
        'Nyproduktion',
        'Kooperativ',
        'Ungdom',
      ])
    })

    it('continues past a caption the contact already holds', async () => {
      soapRequestMock
        .mockResolvedValueOnce(resultBase(false, 'Kötyp finns redan') as never)
        .mockResolvedValue(resultBase(true) as never)

      const result = await addApplicantToToWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result).toEqual({ ok: true, data: undefined })
      expect(sentCaptions()).toEqual(['Bilplats (intern)', 'Bilplats (extern)'])
    })

    it('stops and reports a caption Xpand does not know', async () => {
      soapRequestMock.mockResolvedValue(
        resultBase(false, 'Kötyp saknas') as never
      )

      const result = await addApplicantToToWaitingList(
        'P123456',
        WaitingListType.Storage
      )

      expect(result).toEqual({ ok: false, err: 'waiting-list-type-not-found' })
    })
  })

  describe(removeApplicantFromWaitingList, () => {
    it('removes every caption of the type', async () => {
      soapRequestMock.mockResolvedValue(resultBase(true) as never)

      const result = await removeApplicantFromWaitingList(
        'P123456',
        WaitingListType.Housing
      )

      expect(result).toEqual({ ok: true, data: undefined })
      expect(sentCaptions()).toEqual([
        'Bostad',
        'Nyproduktion',
        'Kooperativ',
        'Ungdom',
      ])
    })

    it('continues past a caption the contact is not queued for', async () => {
      soapRequestMock
        .mockResolvedValueOnce(resultBase(false, 'Kötid saknas') as never)
        .mockResolvedValue(resultBase(true) as never)

      const result = await removeApplicantFromWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result).toEqual({ ok: true, data: undefined })
      expect(sentCaptions()).toEqual(['Bilplats (intern)', 'Bilplats (extern)'])
    })

    it('stops and reports an unknown failure', async () => {
      soapRequestMock
        .mockResolvedValueOnce(resultBase(false, 'Något gick fel') as never)
        .mockResolvedValue(resultBase(true) as never)

      const result = await removeApplicantFromWaitingList(
        'P123456',
        WaitingListType.ParkingSpace
      )

      expect(result).toEqual({ ok: false, err: 'unknown' })
      expect(sentCaptions()).toEqual(['Bilplats (intern)'])
    })
  })
})
