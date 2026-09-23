// @vitest-environment jsdom
import { sanitizeGuideHtml } from './sanitizeHtml'

describe('sanitizeGuideHtml', () => {
  it('keeps the allowed formatting tags', () => {
    const html =
      '<p>Fyll i <strong>datum</strong> och <em>orsak</em>:</p><ul><li>Ett</li></ul>'
    expect(sanitizeGuideHtml(html)).toBe(html)
  })

  it('strips scripts, event handlers and disallowed tags', () => {
    expect(
      sanitizeGuideHtml(
        '<p onclick="x()">Hej</p><script>alert(1)</script><h1>Rubrik</h1>'
      )
    ).toBe('<p>Hej</p>Rubrik')
  })

  it('keeps links but drops javascript: urls', () => {
    expect(
      sanitizeGuideHtml('<a href="https://example.com" rel="noopener">x</a>')
    ).toBe('<a href="https://example.com" rel="noopener">x</a>')
    expect(sanitizeGuideHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a>x</a>'
    )
  })

  it('keeps target and rel on external links', () => {
    const html =
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>'
    expect(sanitizeGuideHtml(html)).toBe(html)
  })

  it('keeps a relative link but strips a protocol-relative one', () => {
    expect(sanitizeGuideHtml('<a href="/relative">x</a>')).toBe(
      '<a href="/relative">x</a>'
    )
    expect(sanitizeGuideHtml('<a href="//evil.example">x</a>')).toBe('<a>x</a>')
  })

  it('allows only the schemes the backend allows', () => {
    const allowed = [
      'https://example.com',
      'http://example.com',
      'mailto:a@example.com',
      '/guider/min-guide',
      '#steg-1',
      '?q=1',
    ]
    allowed.forEach((href) => {
      expect(sanitizeGuideHtml(`<a href="${href}">x</a>`)).toBe(
        `<a href="${href}">x</a>`
      )
    })

    const blocked = [
      // Protocol-relative: it looks relative but leaves the site.
      '//evil.example',
      'data:text/html;base64,PHA+',
      'vbscript:msgbox(1)',
      'tel:0700000000',
      'ftp://example.com',
    ]
    blocked.forEach((href) => {
      expect(sanitizeGuideHtml(`<a href="${href}">x</a>`)).toBe('<a>x</a>')
    })
  })
})
