import { Factory } from 'fishery'
import { RelatedContact } from '@src/domain/contact'

export const RelatedContactFactory = Factory.define<RelatedContact>(
  ({ sequence }) => ({
    contactCode: `P${String(sequence).padStart(6, '0')}`,
    role: 'trustee',
    fullName: 'Testsson Test',
  })
)
