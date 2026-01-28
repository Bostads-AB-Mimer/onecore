import { Factory } from 'fishery'
import { CreateComponentSubtype } from '../../types/component-subtype'

// Note: typeId must be provided via .build({ typeId }) since it's a FK
export const ComponentSubtypeFactory = Factory.define<CreateComponentSubtype>(
  ({ sequence }) => ({
    subTypeName: `Test Subtype ${sequence}`,
    typeId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    xpandCode: `XP${sequence}`,
    depreciationPrice: 1000,
    technicalLifespan: 20,
    economicLifespan: 15,
    replacementIntervalMonths: 120,
    quantityType: 'UNIT',
  })
)
