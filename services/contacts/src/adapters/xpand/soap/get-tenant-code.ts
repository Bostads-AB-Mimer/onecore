import { ContactWriteError } from '@src/adapters/contact-writer'
import { AdapterResult } from '@src/adapters/types'
import { XpandSoapConfig } from '@src/common/config'
import { el, envelope } from './xml'
import { SoapBody } from './client'

export const GET_TENANT_CODE_ACTION =
  'http://incit.xpand.eu/service/GetTenantCodeByCivicNumber/GetTenantCodeByCivicNumber'
export const GET_TENANT_CODE_WRAPPER = 'GetTenantCodeByCivicNumberRequest'

/**
 * Builds the `GetTenantCodeByCivicNumber` request envelope.
 *
 * Members alphabetical, as everywhere in this contract.
 */
export const buildGetTenantCodeEnvelope = (
  config: XpandSoapConfig,
  nationalId: string
): string =>
  envelope({
    action: GET_TENANT_CODE_ACTION,
    wrapper: GET_TENANT_CODE_WRAPPER,
    url: config.url,
    body: [
      el('CivicNumber', nationalId),
      el('CompanyCode', config.companyCode),
      el('MessageCulture', config.messageCulture),
    ].join(''),
  })

/**
 * Interprets a `TenantCodeResult`.
 *
 * `Success: false` means no contact has that identity number, which is a
 * legitimate answer rather than an error — hence `contactCode: null` instead
 * of a failure result.
 */
export const parseGetTenantCodeResponse = (
  body: SoapBody
): AdapterResult<{ contactCode: string | null }, ContactWriteError> => {
  const result = body['TenantCodeResult']

  if (typeof result !== 'object' || result === null) {
    return { ok: false, err: 'xpand-malformed-response' }
  }

  const fields = result as Record<string, unknown>
  const success =
    fields['Success'] === true ||
    String(fields['Success']).trim().toLowerCase() === 'true'

  if (!success) return { ok: true, data: { contactCode: null } }

  const tenantData = fields['TenantData']
  if (typeof tenantData !== 'object' || tenantData === null) {
    return { ok: true, data: { contactCode: null } }
  }

  const code = (tenantData as Record<string, unknown>)['TenantCodeMember']
  const contactCode = typeof code === 'string' ? code.trim() : ''

  return { ok: true, data: { contactCode: contactCode || null } }
}
