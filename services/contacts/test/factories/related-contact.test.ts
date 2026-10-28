import { RelatedContactSchema } from '@src/services/contacts-service/schema'
import * as factory from './index'

describe('RelatedContactFactory', () => {
  it('builds objects that satisfy RelatedContactSchema', () => {
    const result = RelatedContactSchema.safeParse(
      factory.relatedContact.build()
    )
    if (!result.success) console.error(result.error)
    expect(result.success).toBe(true)
  })

  it('builds with overrides that still satisfy RelatedContactSchema', () => {
    const built = factory.relatedContact.build({
      role: 'administratorFor',
      fullName: 'Huvudman Test',
    })
    const result = RelatedContactSchema.safeParse(built)
    if (!result.success) console.error(result.error)
    expect(result.success).toBe(true)
    expect(built.role).toBe('administratorFor')
    expect(built.fullName).toBe('Huvudman Test')
  })
})
