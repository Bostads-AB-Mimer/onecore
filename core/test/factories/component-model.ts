import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentModelFactory = Factory.define<schemas.ComponentModel>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0003-${sequence.toString().padStart(12, '0')}`,
    modelName: `Model ${sequence}`,
    componentSubtypeId: '00000000-0000-0000-0002-000000000001',
    currentPrice: 15000,
    currentInstallPrice: 3000,
    warrantyMonths: 24,
    manufacturer: `Manufacturer ${sequence}`,
    technicalSpecification: 'Technical specs',
    installationInstructions: 'Installation instructions',
    dimensions: '100x50x30 cm',
    coclassCode: `CC${sequence.toString().padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subtype: undefined,
  })
)
