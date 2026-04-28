import { Factory } from 'fishery'
import type { ContactIndividual } from '@onecore/contacts/domain'

export const DomainContactFactory = Factory.define<ContactIndividual>(({ sequence }) => ({
  type: 'individual',
  contactCode: `P${100000 + sequence}`,
  contactKey: `k-${sequence}`,
  personal: {
    nationalId: '199001011234',
    birthDate: '1990-01-01',
    firstName: 'Knut',
    lastName: 'Kansen',
    fullName: 'Kansen, Knut',
  },
  communication: {
    phoneNumbers: [],
    emailAddresses: [],
    specialAttention: false,
  },
  addresses: [],
}))
