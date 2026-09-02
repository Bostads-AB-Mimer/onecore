/**
 * Minimal XML construction helpers for hand-built SOAP envelopes.
 *
 * Xpand's Incit service is WCF-based, and its DataContractSerializer is
 * order-sensitive: members are expected base-class-first, then alphabetically
 * within each level of the inheritance chain. Getting the order wrong produces
 * a silent validation failure rather than a useful error, so the envelope
 * builders that use these helpers must keep their element order deliberate and
 * test-guarded.
 *
 * NAMESPACES ARE EQUALLY LOAD-BEARING. Operation parameters (e.g.
 * `MainApplicant08352`, `CompanyCode`) live in `http://incit.xpand.eu/` ('inc'),
 * but the members *inside* a data contract are qualified in
 * `http://incit.xpand.eu/data/` ('data') — the WSDL's data schemas declare
 * `elementFormDefault="qualified"`. A member sent in the wrong namespace is not
 * rejected: DataContractSerializer silently skips it as unknown, then fails at
 * the end complaining that a required member (the first being `CivicNumber`)
 * never arrived. The same split already exists in leasing's `createLease`
 * envelope, which nests `data:`-prefixed contract members inside `inc:` parts.
 *
 * Fields we do not populate may simply be omitted — no member on the contract
 * is marked `EmitDefaultValue=false`, so the serializer tolerates their
 * absence. Only the relative order of the elements we *do* send matters.
 */

/** The two element namespaces used in request bodies — see module docblock. */
export type XmlNs = 'inc' | 'data'

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/**
 * Escapes a value for inclusion in XML character data or an attribute.
 *
 * Every interpolated value must go through this. Unlike the waiting-list
 * envelopes elsewhere in the platform — which only ever interpolate contact
 * codes and fixed queue captions — contact creation carries free text typed by
 * a caseworker. A company called `Firma A & B AB` produces malformed XML
 * without escaping.
 */
export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char])

/** Renders a single element with escaped text content. */
export const el = (
  name: string,
  value: string | number | boolean,
  ns: XmlNs = 'inc'
): string => `<${ns}:${name}>${escapeXml(String(value))}</${ns}:${name}>`

/**
 * Renders an element only when the value is meaningful.
 *
 * Null, undefined and blank strings are omitted rather than sent as empty
 * elements — Xpand treats an empty element as an explicit blank value, which
 * is not the same as leaving a field to its default.
 */
export const elOpt = (
  name: string,
  value: string | number | boolean | null | undefined,
  ns: XmlNs = 'inc'
): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' && value.trim() === '') return ''
  return el(name, value, ns)
}

/** Wraps child XML in a named element. Children are assumed already escaped. */
export const wrap = (
  name: string,
  children: string,
  ns: XmlNs = 'inc'
): string => `<${ns}:${name}>${children}</${ns}:${name}>`

/**
 * Builds a complete SOAP 1.2 envelope.
 *
 * `action` is the full WS-Addressing action URI and `wrapper` the name of the
 * body element. Neither can be derived from the other: Incit is inconsistent
 * about it. `AddApplicantWaitingListTime` repeats the bare operation name
 * (`.../service/AddApplicantWaitingListTime/AddApplicantWaitingListTime`),
 * while `CreateApplicant08352` uses the interface name with an `I` prefix
 * (`.../service/ICreateApplicant08352/CreateApplicant08352`). The wrapper
 * element name is a third thing again (`CreateApplicantRequest08352`).
 *
 * Take all three from the WSDL rather than constructing them.
 */
export const envelope = (params: {
  action: string
  wrapper: string
  url: string
  body: string
}): string => {
  const { action, wrapper, url, body } = params

  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/" xmlns:data="http://incit.xpand.eu/data/">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:Action>${escapeXml(action)}</wsa:Action>
    <wsa:To>${escapeXml(url)}</wsa:To>
  </soap:Header>
  <soap:Body>
    <ser:${wrapper}>
${body}
    </ser:${wrapper}>
  </soap:Body>
</soap:Envelope>`
}
