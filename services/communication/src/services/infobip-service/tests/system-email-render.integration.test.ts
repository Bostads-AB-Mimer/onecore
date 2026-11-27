import { getSystemTemplate } from '../../template-service/adapters/db'
import { SYSTEM_EMAIL_FIXTURES } from '../../template-service/system-email-fixtures'
import {
  renderEmail,
  SYSTEM_TEMPLATE_KEYS,
} from '../../template-service/system-templates'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

/**
 * Proves the send path supplies every token each seeded template uses: the
 * templates come from the migrated test DB, the values from the fixtures,
 * which run typed request payloads through the send functions' builders.
 */
describe('every system template renders with its send function placeholders', () => {
  it.each(SYSTEM_TEMPLATE_KEYS)('%s', async (key) => {
    const rendered = renderEmail(
      await getSystemTemplate(key),
      SYSTEM_EMAIL_FIXTURES[key]
    )
    expect(rendered.subject).not.toContain('{{')
    expect(rendered.html).not.toContain('{{')
    expect(rendered.text).not.toContain('{{')
  })
})
