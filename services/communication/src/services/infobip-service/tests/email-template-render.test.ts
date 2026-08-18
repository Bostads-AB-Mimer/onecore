import {
  buildParkingSpacePlaceholders,
  fillTokens,
  htmlToText,
  renderTemplate,
} from '../adapters/email-template-render'

describe('htmlToText', () => {
  it('strips markup and turns block tags into line breaks', () => {
    const html = '<p>Hej {{firstName}}!</p><p>Adress: {{address}}</p>'
    expect(htmlToText(html)).toBe('Hej {{firstName}}!\nAdress: {{address}}')
  })

  it('decodes the entities Infobip emits and collapses whitespace', () => {
    const html = '<p>Mimer&#160;&amp;&nbsp;co</p>Rad2'
    expect(htmlToText(html)).toBe('Mimer & co\nRad2')
  })

  it('drops head/style/script and comments', () => {
    const html = '<head><style>p{color:red}</style></head><!-- x --><p>Kvar</p>'
    expect(htmlToText(html)).toBe('Kvar')
  })

  it('leaves placeholder tokens untouched', () => {
    expect(htmlToText('<p>Hyra: {{rent}}</p>')).toContain('{{rent}}')
  })

  it('keeps href targets that would otherwise vanish with the tag', () => {
    const html = '<p>Se erbjudandet: <a href="{{offerURL}}">här</a></p>'
    expect(htmlToText(html)).toBe('Se erbjudandet: här ({{offerURL}})')
  })

  it('does not repeat mailto:/tel: links whose text is the address/number', () => {
    const html =
      '<p><a href="mailto:post@mimer.nu">post@mimer.nu</a>, ' +
      '<a href="tel:+4621397000">021-39 70 00</a></p>'
    expect(htmlToText(html)).toBe('post@mimer.nu, 021-39 70 00')
  })

  it('drops {$...} system-placeholder hrefs like the unsubscribe link', () => {
    const html = '<p>Väljer du <a href="{$unsubscribe}">UNSUBSCRIBE</a></p>'
    expect(htmlToText(html)).toBe('Väljer du UNSUBSCRIBE')
  })

  it('separates table cells so label and value do not run together', () => {
    const html = '<table><tr><td>Hyra:</td><td>{{rent}}</td></tr></table>'
    expect(htmlToText(html)).toBe('Hyra: {{rent}}')
  })
})

describe('fillTokens', () => {
  it('substitutes matching placeholders', () => {
    expect(fillTokens('Hej {{firstName}}', { firstName: 'Anna' })).toBe(
      'Hej Anna'
    )
  })

  it('renders a token with no matching placeholder as empty', () => {
    expect(fillTokens('Hej {{firstName}}!', {})).toBe('Hej !')
  })

  it('leaves malformed Infobip tokens like {$address} untouched', () => {
    expect(fillTokens('på {$address}.', { address: 'Storgatan 1' })).toBe(
      'på {$address}.'
    )
  })
})

describe('buildParkingSpacePlaceholders', () => {
  it('formats rent and dates and maps the offer fields', () => {
    const placeholders = buildParkingSpacePlaceholders({
      address: 'Storgatan 1',
      firstName: 'Anna',
      availableFrom: '2026-08-01T00:00:00.000Z',
      deadlineDate: '2026-07-20T00:00:00.000Z',
      rent: '650',
      type: 'Bilplats',
      parkingSpaceId: '1234567',
      objectId: '42',
      offerURL: 'https://example.com/offer',
    })

    expect(placeholders).toMatchObject({
      address: 'Storgatan 1',
      firstName: 'Anna',
      rent: '650 kr',
      availableFrom: '2026-08-01',
      deadlineDate: '2026-07-20',
      offerURL: 'https://example.com/offer',
    })
    expect(placeholders.parkingSpaceImage).toContain('1234567')
  })

  it('omits fields that are absent on the email (one builder, all types)', () => {
    const placeholders = buildParkingSpacePlaceholders({
      address: 'Storgatan 1',
      rent: '650',
      type: 'Bilplats',
      parkingSpaceId: '1234567',
      objectId: '42',
    })

    expect(placeholders.rent).toBe('650 kr')
    expect(placeholders).not.toHaveProperty('offerURL')
    expect(placeholders).not.toHaveProperty('leaseId')
    expect(placeholders).not.toHaveProperty('firstName')
  })
})

describe('renderTemplate', () => {
  it('merges the sent placeholders into the fetched template as plaintext', () => {
    const rendered = renderTemplate(
      {
        subject: 'Erbjudande om bilplats',
        html:
          '<p>Hej {{firstName}}!</p><p>Adress: {{address}}</p>' +
          '<p>Hyra: {{rent}}</p>',
      },
      { firstName: 'Anna', address: 'Storgatan 1', rent: '650' }
    )

    expect(rendered).toEqual({
      subject: 'Erbjudande om bilplats',
      body: 'Hej Anna!\nAdress: Storgatan 1\nHyra: 650 kr',
    })
  })

  it('handles a null template subject', () => {
    const rendered = renderTemplate({ subject: null, html: '<p>Hej</p>' }, {})
    expect(rendered).toEqual({ subject: '', body: 'Hej' })
  })

  it('returns null (route falls back) when a field cannot be rendered', () => {
    const rendered = renderTemplate(
      { subject: 'x', html: '<p>{{availableFrom}}</p>' },
      { availableFrom: 'not-a-date' }
    )
    expect(rendered).toBeNull()
  })
})
