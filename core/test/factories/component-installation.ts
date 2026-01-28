import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentInstallationFactory =
  Factory.define<schemas.ComponentInstallation>(({ sequence }) => ({
    id: `00000000-0000-0000-0005-${sequence.toString().padStart(12, '0')}`,
    componentId: '00000000-0000-0000-0004-000000000001',
    spaceId: `ROOM-${sequence}`,
    spaceType: 'OBJECT',
    installationDate: new Date().toISOString(),
    deinstallationDate: null,
    orderNumber: `ORD-${sequence.toString().padStart(6, '0')}`,
    cost: 3000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    component: undefined,
  }))
