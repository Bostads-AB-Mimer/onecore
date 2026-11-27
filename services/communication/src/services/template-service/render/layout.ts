import he from 'he'

import config from '../../../common/config'
import { CONTENT_WIDTH, EMAIL_STYLES } from './styles'

type Organisation = typeof config.organisation
type Fragment = { html: string; text: string }

// Fields the layout renders; an empty one would leave a broken header or
// footer, so rendering fails instead of sending it.
const REQUIRED_FIELDS: (keyof Organisation)[] = [
  'logoUrl',
  'name',
  'visitingAddress',
  'email',
  'phone',
  'phoneTel',
  'privacyPolicyUrl',
]

// Config the layout needs is empty; rendering stops before anything is sent.
export class EmailLayoutConfigError extends Error {
  readonly code = 'EMAIL_CONFIG_MISSING'
  constructor(readonly field: string) {
    super(`Email layout: config organisation.${field} is empty`)
    this.name = 'EmailLayoutConfigError'
  }
}

const readOrganisation = (): Organisation => {
  const organisation = config.organisation
  for (const field of REQUIRED_FIELDS) {
    if (!organisation[field]?.trim()) {
      throw new EmailLayoutConfigError(field)
    }
  }
  return organisation
}

const e = (value: string) => he.escape(value)
const footerLine = (html: string) =>
  `<p style="${EMAIL_STYLES.footerText}">${html}</p>`
const link = (href: string, label: string) =>
  `<a href="${e(href)}" style="${EMAIL_STYLES.footerLink}">${e(label)}</a>`

// One footer for every email: contact details and the privacy policy.
const footerHtml = (org: Organisation): string =>
  [
    footerLine(
      `${e(org.name)}, besöksadress: ${e(org.visitingAddress)}. ` +
        `${link(`mailto:${org.email}`, org.email)}, ${link(`tel:${org.phoneTel}`, org.phone)}`
    ),
    footerLine(
      link(org.privacyPolicyUrl, 'Dataskydd och hantering av personuppgifter')
    ),
  ].join('')

const footerLines = (org: Organisation): string[] => [
  `${org.name}, besöksadress: ${org.visitingAddress}`,
  `${org.email}, ${org.phone}`,
  `Dataskydd och hantering av personuppgifter: ${org.privacyPolicyUrl}`,
]

/**
 * Logo and footer as the editor shows them around a template. Empty instead
 * of throwing when the config is missing; the preview reports that error.
 */
export const layoutChrome = (): {
  logoUrl: string | null
  footerLines: string[]
} => {
  try {
    const org = readOrganisation()
    return { logoUrl: org.logoUrl, footerLines: footerLines(org) }
  } catch (err: unknown) {
    if (err instanceof EmailLayoutConfigError) {
      return { logoUrl: null, footerLines: [] }
    }
    throw err
  }
}

/**
 * Wraps a rendered template fragment in the email shell: logo header,
 * content and footer. Table layout and inline styles only, since that is
 * what Outlook and most webmail clients render reliably.
 */
export const wrapInLayout = (fragment: Fragment): Fragment => {
  const org = readOrganisation()

  // Outlook desktop ignores max-width, so the mso-only table pins the width.
  const html =
    '<!DOCTYPE html>' +
    '<html lang="sv" xmlns:o="urn:schemas-microsoft-com:office:office"><head>' +
    '<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->' +
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="x-apple-disable-message-reformatting">' +
    `<title>${e(org.name)}</title>` +
    '</head>' +
    `<body style="${EMAIL_STYLES.body}">` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#ffffff;">' +
    '<tr><td align="center">' +
    `<!--[if mso]><table role="presentation" width="${CONTENT_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:${CONTENT_WIDTH}px;">` +
    `<tr><td style="${EMAIL_STYLES.header}">` +
    `<img src="${e(org.logoUrl)}" alt="${e(org.name)}" width="104" style="display:block;border:none;outline:none;height:auto;">` +
    '</td></tr>' +
    `<tr><td style="${EMAIL_STYLES.content}">${fragment.html}</td></tr>` +
    `<tr><td style="${EMAIL_STYLES.footer}">${footerHtml(org)}</td></tr>` +
    '</table>' +
    '<!--[if mso]></td></tr></table><![endif]-->' +
    '</td></tr></table>' +
    '</body></html>'

  const text = `${fragment.text}\n\n${footerLines(org).join('\n')}`

  return { html, text }
}
