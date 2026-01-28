import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentFactory = Factory.define<schemas.Component>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0004-${sequence.toString().padStart(12, '0')}`,
    modelId: '00000000-0000-0000-0003-000000000001',
    serialNumber: `SN-${sequence.toString().padStart(6, '0')}`,
    specifications: 'Component specifications',
    additionalInformation: 'Additional info',
    warrantyStartDate: new Date().toISOString(),
    warrantyMonths: 24,
    priceAtPurchase: 15000,
    depreciationPriceAtPurchase: 5000,
    ncsCode: 'S 0502-Y',
    status: 'ACTIVE',
    condition: 'NEW',
    quantity: 1,
    economicLifespan: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: undefined,
    componentInstallations: undefined,
  })
)
