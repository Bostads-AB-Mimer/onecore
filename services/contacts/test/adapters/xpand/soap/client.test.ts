import soapRequest from 'easy-soap-request'
import { logger } from '@onecore/utilities'

import { makeSoapClient } from '@src/adapters/xpand/soap/client'
import { XpandSoapConfig } from '@src/common/config'

jest.mock('easy-soap-request')

const soapRequestMock = soapRequest as jest.MockedFunction<typeof soapRequest>

const config: XpandSoapConfig = {
  url: 'https://xpand.example/Incit/Service/External/ServiceCatalogue',
  username: 'user',
  password: 'pass',
  messageCulture: '1053',
  companyCode: '001',
  timeoutMs: 30000,
}

const ok = (body: string) =>
  ({ response: { body, statusCode: 200, headers: {} } }) as never

/** An axios-shaped rejection, which is what easy-soap-request throws. */
const httpError = (status: number, data?: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
  })

const envelope = (inner: string) =>
  `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
     <s:Body>${inner}</s:Body>
   </s:Envelope>`

const FAULT = envelope(`
  <s:Fault>
    <s:Code><s:Value>s:Sender</s:Value></s:Code>
    <s:Reason><s:Text xml:lang="en-US">Expecting element 'ContactCode'</s:Text></s:Reason>
  </s:Fault>
`)

beforeEach(() => {
  jest.resetAllMocks()
})

describe('makeSoapClient', () => {
  it('returns the parsed SOAP body on success', async () => {
    soapRequestMock.mockResolvedValue(
      ok(
        envelope(
          '<CreateNewEntityResult><Success>true</Success></CreateNewEntityResult>'
        )
      )
    )

    const result = await makeSoapClient(config).call('urn:action', '<xml/>')

    expect(result).toEqual({
      ok: true,
      data: { CreateNewEntityResult: { Success: true } },
    })
  })

  /**
   * The load-bearing guard. Test and CI environments leave XPAND_SOAP__URL
   * unset, and this is what makes a test run structurally unable to register a
   * real customer in Xpand — a write that has no delete to undo it.
   */
  it('refuses to call at all when no url is configured', async () => {
    const result = await makeSoapClient({ ...config, url: '' }).call(
      'urn:action',
      '<xml/>'
    )

    expect(result).toEqual({ ok: false, err: 'write-backend-not-configured' })
    expect(soapRequestMock).not.toHaveBeenCalled()
  })

  it.each([401, 403])('maps %i to an auth failure', async (status) => {
    soapRequestMock.mockRejectedValue(httpError(status))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-auth-failed',
    })
  })

  /**
   * A Fault means our own request was malformed — a namespace or ordering the
   * DataContractSerializer would not accept — which is a different thing from
   * Xpand refusing on business grounds, and a caseworker can do nothing about
   * it. It must not be reported as an ordinary rejection.
   */
  it('classifies a SOAP Fault delivered as HTTP 500', async () => {
    soapRequestMock.mockRejectedValue(httpError(500, FAULT))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-fault',
      detail: "Expecting element 'ContactCode'",
    })
  })

  it('classifies a SOAP Fault returned with a 200', async () => {
    soapRequestMock.mockResolvedValue(ok(FAULT))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-fault',
      detail: "Expecting element 'ContactCode'",
    })
  })

  it('reports a transport failure as unavailable, not as a rejection', async () => {
    soapRequestMock.mockRejectedValue(new Error('ETIMEDOUT'))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-unavailable',
    })
  })

  it('reports a 5xx without a fault body as unavailable', async () => {
    soapRequestMock.mockRejectedValue(httpError(503, '<html>gateway</html>'))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-unavailable',
    })
  })

  /**
   * Distinct from a failure: the call may have gone through, so the caller must
   * try to recover the contact code rather than retry the create.
   */
  it('reports a response without a SOAP Body as malformed', async () => {
    soapRequestMock.mockResolvedValue(ok('<html>not soap at all</html>'))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-malformed-response',
    })
  })

  it('reports an empty response as malformed', async () => {
    soapRequestMock.mockResolvedValue(ok(''))

    expect(await makeSoapClient(config).call('urn:action', '<xml/>')).toEqual({
      ok: false,
      err: 'xpand-malformed-response',
    })
  })

  /**
   * An AxiosError carries its request config: the Basic Authorization header
   * and the submitted envelope, with the national ID and the clear-text
   * password. Logs ship to Elasticsearch, so none of it may reach the logger.
   */
  it('never logs credentials or the submitted envelope on a transport error', async () => {
    const errorSpy = jest.spyOn(logger, 'error')
    soapRequestMock.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 500'), {
        code: 'ERR_BAD_RESPONSE',
        config: {
          headers: { Authorization: 'Basic c2VjcmV0' },
          data: '<soap:Envelope><data:CivicNumber>199007292387</data:CivicNumber><data:Password>hemligt</data:Password></soap:Envelope>',
        },
        response: { status: 500, data: '<html>oops</html>' },
      })
    )

    await makeSoapClient(config).call('urn:action', '<xml/>')

    expect(errorSpy).toHaveBeenCalled()
    const logged = JSON.stringify(errorSpy.mock.calls)
    expect(logged).not.toContain('Authorization')
    expect(logged).not.toContain('c2VjcmV0')
    expect(logged).not.toContain('199007292387')
    expect(logged).not.toContain('hemligt')
    // The allowlisted metadata still gets through.
    expect(logged).toContain('ERR_BAD_RESPONSE')
    expect(logged).toContain('500')
  })
})
