import { Factory } from 'fishery'
import * as schemas from '../../src/services/property-base-service/schemas'

export const ComponentEventFactory = Factory.define<schemas.ComponentEvent>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0006-${sequence.toString().padStart(12, '0')}`,
    componentId: '00000000-0000-0000-0004-000000000001',
    eventType: 'REPAIRED',
    occurredAt: '2026-10-28',
    sourceType: 'WORK_ORDER',
    sourceId: `od-${sequence}`,
    relatedComponentId: null,
    actor: 'jdoe',
    note: null,
    createdAt: new Date().toISOString(),
  })
)
