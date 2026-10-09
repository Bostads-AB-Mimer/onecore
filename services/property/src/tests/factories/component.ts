import { Factory } from 'fishery'
import { CreateComponent } from '../../types/component-instance'

// Note: subtypeId and modelId must be provided via .build({ ... }) since they are FKs
export const ComponentFactory = Factory.define<CreateComponent>(
  ({ sequence }) => ({
    subtypeId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    modelId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    serialNumber: `SN-${sequence}-${Date.now()}`,
    specifications: undefined,
    additionalInformation: undefined,
    warrantyStartDate: undefined,
    warrantyMonths: 24,
    priceAtPurchase: 5000,
    depreciationPriceAtPurchase: 4000,
    ncsCode: undefined,
    status: 'ACTIVE',
    condition: 'NEW',
    quantity: 1,
    economicLifespan: 15,
  })
)
