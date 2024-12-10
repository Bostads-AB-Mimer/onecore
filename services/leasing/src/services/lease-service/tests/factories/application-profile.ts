import { Factory } from 'fishery'
import {
  ApplicationProfile,
  ApplicationProfileHousingReference,
} from 'onecore-types'

export const ApplicationProfileFactory = Factory.define<ApplicationProfile>(
  ({ sequence }) => ({
    id: sequence,
    contactCode: '12345',
    numAdults: 1,
    numChildren: 1,
    housingType: 'foo',
    landlord: 'baz',
    housingTypeDescription: 'qux',
    createdAt: new Date(),
    expiresAt: new Date(),
    housingReference: ApplicationProfileHousingReferenceFactory.build(),
  })
)

export const ApplicationProfileHousingReferenceFactory =
  Factory.define<ApplicationProfileHousingReference>(({ sequence }) => ({
    id: sequence,
    applicationProfileId: 1,
    email: 'email',
    name: 'name',
    phone: 'phone',
    reviewStatus: 'status',
    reviewedAt: new Date(),
    expiresAt: new Date(),
    reviewStatusReason: 'reason',
    createdAt: new Date(),
  }))
