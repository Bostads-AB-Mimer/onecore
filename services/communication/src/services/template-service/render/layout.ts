import he from 'he'

import config from '../../../common/config'
import { CONTENT_WIDTH, EMAIL_STYLES } from './styles'

export type EmailFooter = 'contact' | 'payment' | 'none'

type Organisation = typeof config.organisation
type Fragment = { html: string; text: string }

// Fields each footer renders; an empty one would leave a broken footer, so
// rendering fails instead of sending it.
const REQUIRED_FIELDS: Record<EmailFooter, (keyof Organisation)[]> = {
  contact: [
    'name',
    'visitingAddress',
    'email',
    'phone',
    'phoneTel',
    'privacyPolicyUrl',
  ],
  payment: ['name', 'website', 'orgNumber'],
  none: [],
}

// Payment details are optional (env, empty by default): an empty one just
// leaves its line out.
const paymentLines = (org: Organisation): [string, string][] => {
  const { bankgiro, bic, iban, vatNumber } = config.paymentDetails
  const lines: [string, string][] = [
    ['Bankgiro', bankgiro],
    ['BIC/SWIFT', bic],
    ['IBAN', iban],
    ['Momsreg.nr', vatNumber],
    ['Org.nr', org.orgNumber],
  ]
  return lines.filter(([, value]) => value.trim() !== '')
}

// Config the layout needs is empty; rendering stops before anything is sent.
export class EmailLayoutConfigError extends Error {
  readonly code = 'EMAIL_CONFIG_MISSING'
  constructor(readonly field: string) {
    super(`Email layout: config organisation.${field} is empty`)
    this.name = 'EmailLayoutConfigError'
  }
}

const readOrganisation = (footer: EmailFooter): Organisation => {
  const organisation = config.organisation
  for (const field of ['logoUrl' as const, ...REQUIRED_FIELDS[footer]]) {
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
const websiteLabel = (url: string) =>
  url.replace(/^https?:\/\//i, '').replace(/\/$/, '')

const footerHtml = (footer: EmailFooter, org: Organisation): string => {
  switch (footer) {
    case 'contact':
      return [
        footerLine(
          `${e(org.name)}, besöksadress: ${e(org.visitingAddress)}. ` +
            `${link(`mailto:${org.email}`, org.email)}, ${link(`tel:${org.phoneTel}`, org.phone)}`
        ),
        footerLine(
          link(
            org.privacyPolicyUrl,
            'Dataskydd och hantering av personuppgifter'
          )
        ),
      ].join('')
    case 'payment':
      return [
        ...paymentLines(org).map(([label, value]) =>
          footerLine(`${label}: ${e(value)}`)
        ),
        footerLine(
          `${e(org.name)}, ${link(org.website, websiteLabel(org.website))}`
        ),
      ].join('')
    case 'none':
      return ''
  }
}

const footerText = (footer: EmailFooter, org: Organisation): string => {
  switch (footer) {
    case 'contact':
      return [
        `${org.name}, besöksadress: ${org.visitingAddress}`,
        `${org.email}, ${org.phone}`,
        `Dataskydd och hantering av personuppgifter: ${org.privacyPolicyUrl}`,
      ].join('\n')
    case 'payment':
      return [
        ...paymentLines(org).map(([label, value]) => `${label}: ${value}`),
        `${org.name}, ${websiteLabel(org.website)}`,
      ].join('\n')
    case 'none':
      return ''
  }
}

/**
 * Wraps a rendered template fragment in the email shell: logo header,
 * content and the chosen footer. Table layout and inline styles only, since
 * that is what Outlook and most webmail clients render reliably.
 */
export const wrapInLayout = (
  fragment: Fragment,
  footer: EmailFooter
): Fragment => {
  const org = readOrganisation(footer)
  const footerBlock = footerHtml(footer, org)

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
    (footerBlock
      ? `<tr><td style="${EMAIL_STYLES.footer}">${footerBlock}</td></tr>`
      : '') +
    '</table>' +
    '<!--[if mso]></td></tr></table><![endif]-->' +
    '</td></tr></table>' +
    '</body></html>'

  const footerPlain = footerText(footer, org)
  const text = footerPlain
    ? `${fragment.text}\n\n${footerPlain}`
    : fragment.text

  return { html, text }
}
