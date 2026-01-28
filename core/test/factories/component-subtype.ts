import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentSubtypeFactory = Factory.define<schemas.ComponentSubtype>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0002-${sequence.toString().padStart(12, '0')}`,
    subTypeName: `Subtype ${sequence}`,
    typeId: '00000000-0000-0000-0001-000000000001',
    xpandCode: `XP${sequence.toString().padStart(4, '0')}`,
    depreciationPrice: 5000,
    technicalLifespan: 20,
    economicLifespan: 15,
    replacementIntervalMonths: 120,
    quantityType: 'UNIT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    componentType: undefined,
  })
)
