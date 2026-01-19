import { Factory } from 'fishery'
import { CreateComponentModel } from '../../types/component-model'

// Note: componentSubtypeId must be provided via .build({ componentSubtypeId }) since it's a FK
export const ComponentModelFactory = Factory.define<CreateComponentModel>(
  ({ sequence }) => ({
    modelName: `Test Model ${sequence}`,
    componentSubtypeId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    currentPrice: 5000,
    currentInstallPrice: 1000,
    warrantyMonths: 24,
    manufacturer: `Manufacturer ${sequence}`,
    technicalSpecification: undefined,
    installationInstructions: undefined,
    dimensions: undefined,
    coclassCode: undefined,
  })
)
