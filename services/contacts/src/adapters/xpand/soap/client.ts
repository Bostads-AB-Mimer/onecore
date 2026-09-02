import soapRequest from 'easy-soap-request'
import { XMLParser, type X2jOptions } from 'fast-xml-parser'
import { logger } from '@onecore/utilities'

import { XpandSoapConfig } from '@src/common/config'
import { AdapterResult } from '@src/adapters/types'
import { ContactWriteError } from '@src/adapters/contact-writer'

/**
 * Parser configuration shared by every response we read.
 *
 * `removeNSPrefix` strips the `s:` / `a:` namespace prefixes Incit emits, so
 * response bodies can be addressed as `Envelope.Body.<Result>` regardless of
 * which prefix the server happened to use.
 */
const PARSER_OPTIONS: X2jOptions = {
  ignoreAttributes: false,
  removeNSPrefix: true,
}

/** Parsed SOAP body. Shape varies per operation, so callers narrow it. */
export type SoapBody = Record<string, unknown>

export type SoapClient = {
  call: (
    action: string,
    xml: string
  ) => Promise<AdapterResult<SoapBody, ContactWriteError>>
}

const buildHeaders = (config: XpandSoapConfig) => {
  const credentials = Buffer.from(
    `${config.username}:${config.password}`
  ).toString('base64')

  return {
    'Content-Type': 'application/soap+xml;charset=UTF-8;',
    'user-agent': 'onecore-contacts-soap-adapter',
    Authorization: `Basic ${credentials}`,
  }
}

/** Narrow an unknown thrown value to something with an axios-shaped response. */
const errorResponse = (
  err: unknown
): { status?: number; data?: unknown } | undefined => {
  if (typeof err !== 'object' || err === null) return undefined
  const response = (err as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) return undefined
  return response as { status?: number; data?: unknown }
}

/**
 * Extracts the human-readable reason from a SOAP Fault, when the body is one.
 *
 * Incit signals *business* rejections as `Success: false` inside a 200
 * response; a genuine Fault means the request itself was malformed — most
 * often namespace or ordering the DataContractSerializer would not accept.
 * The reason is logged and carried in `detail` for API consumers, but it is
 * .NET-internals text and must never be shown to a caseworker — which is why
 * faults map to `xpand-fault`, whose detail the frontend never renders.
 */
const faultReason = (parsed: unknown): string | undefined => {
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const body = (parsed as Record<string, Record<string, unknown>>)[
    'Envelope'
  ]?.['Body']
  if (typeof body !== 'object' || body === null) return undefined

  const fault = (body as Record<string, unknown>)['Fault']
  if (typeof fault !== 'object' || fault === null) return undefined

  const reason = (fault as Record<string, unknown>)['Reason']
  if (typeof reason === 'object' && reason !== null) {
    const text = (reason as Record<string, unknown>)['Text']
    if (typeof text === 'string') return text
    if (typeof text === 'object' && text !== null) {
      const inner = (text as Record<string, unknown>)['#text']
      if (typeof inner === 'string') return inner
    }
  }

  const faultString = (fault as Record<string, unknown>)['faultstring']
  return typeof faultString === 'string' ? faultString : 'SOAP Fault'
}

/**
 * Creates a client for Xpand's Incit SOAP service.
 *
 * When no url is configured the client refuses every call outright. That is
 * deliberate and load-bearing: test and CI environments leave `XPAND_SOAP__URL`
 * unset, and this guard is what guarantees a test run can never write to a live
 * Xpand instance — contact creation has no delete operation to undo it with.
 */
export const makeSoapClient = (config: XpandSoapConfig): SoapClient => {
  const parser = new XMLParser(PARSER_OPTIONS)

  return {
    call: async (action, xml) => {
      if (!config.url) {
        logger.error(
          { action },
          'xpandSoapClient.call: no XPAND_SOAP__URL configured, refusing call'
        )
        return { ok: false, err: 'write-backend-not-configured' }
      }

      let body: string

      try {
        const { response } = await soapRequest({
          url: config.url,
          headers: buildHeaders(config),
          xml,
          timeout: config.timeoutMs,
        })
        // `body` is typed `any` by easy-soap-request; Incit always returns XML
        // as text, but coerce rather than trust it.
        body = typeof response.body === 'string' ? response.body : ''
      } catch (err) {
        const response = errorResponse(err)
        const status = response?.status

        if (status === 401 || status === 403) {
          logger.error({ err, action, status }, 'xpandSoapClient.call')
          return { ok: false, err: 'xpand-auth-failed' }
        }

        // A SOAP Fault arrives as an HTTP 500 with an envelope body, so it
        // lands here rather than in the success path. It is our request being
        // malformed — not a business rejection, not a transport failure.
        if (typeof response?.data === 'string') {
          const reason = faultReason(parser.parse(response.data))
          if (reason) {
            logger.error({ err, action, reason }, 'xpandSoapClient.call')
            return { ok: false, err: 'xpand-fault', detail: reason }
          }
        }

        logger.error({ err, action, status }, 'xpandSoapClient.call')
        return { ok: false, err: 'xpand-unavailable' }
      }

      try {
        const parsed = parser.parse(body)

        const reason = faultReason(parsed)
        if (reason) {
          logger.error({ action, reason }, 'xpandSoapClient.call')
          return { ok: false, err: 'xpand-fault', detail: reason }
        }

        const envelopeBody = (
          parsed as Record<string, Record<string, unknown>> | undefined
        )?.['Envelope']?.['Body']

        if (typeof envelopeBody !== 'object' || envelopeBody === null) {
          logger.error(
            { action },
            'xpandSoapClient.call: response had no SOAP Body'
          )
          return { ok: false, err: 'xpand-malformed-response' }
        }

        return { ok: true, data: envelopeBody as SoapBody }
      } catch (err) {
        logger.error({ err, action }, 'xpandSoapClient.call')
        return { ok: false, err: 'xpand-malformed-response' }
      }
    },
  }
}
