import { Factory } from 'fishery'
import { CreateComponentInstallation } from '../../types/component-installation'

// Note: componentId must be provided via .build({ componentId }) since it's a FK
export const ComponentInstallationFactory =
  Factory.define<CreateComponentInstallation>(({ sequence }) => ({
    componentId: '00000000-0000-0000-0000-000000000000', // Override with real ID
    spaceId: `ROOM-${String(sequence).padStart(6, '0')}`,
    spaceType: 'OBJECT',
    installationDate: new Date().toISOString(),
    deinstallationDate: undefined,
    orderNumber: undefined,
    cost: 1000,
  }))
