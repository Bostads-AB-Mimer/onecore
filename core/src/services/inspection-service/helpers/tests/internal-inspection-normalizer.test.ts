import { inspection } from '@onecore/types'

import type { components as propertyBaseComponents } from '../../../../adapters/property-base-adapter/generated/api-types'
import { mapInternalRoomsToProtocolRooms } from '../internal-inspection-normalizer'

type InspectionRoom = inspection.InspectionRoom
type PropertyBaseRoom = propertyBaseComponents['schemas']['Room']

const baseRoom = (overrides: Partial<InspectionRoom> = {}): InspectionRoom => ({
  roomId: 'room-1',
  conditions: {
    details: 'OK',
  },
  actions: {
    details: [],
  },
  componentNotes: {
    details: '',
  },
  componentCosts: {
    details: 0,
  },
  componentPhotos: {
    details: [],
  },
  componentCostResponsibilities: {
    details: null,
  },
  photos: [],
  isApproved: false,
  isHandled: false,
  detailComponents: [],
  components: [],
  ...overrides,
})

const propertyRoom = (
  overrides: Partial<PropertyBaseRoom> = {}
): PropertyBaseRoom =>
  ({
    id: 'room-1',
    propertyObjectId: 'po-1',
    code: 'CODE',
    name: 'Kök',
    usage: { shared: false, allowPeriodicWorks: false, spaceType: 0 },
    features: {
      hasToilet: false,
      isHeated: true,
      hasThermostatValve: false,
      orientation: 0,
    },
    dates: {
      installation: null,
      from: '2020-01-01',
      to: '2099-01-01',
      availableFrom: null,
      availableTo: null,
    },
    sortingOrder: 0,
    deleted: false,
    timestamp: '2020-01-01',
    roomType: null,
    ...overrides,
  }) as PropertyBaseRoom

describe('mapInternalRoomsToProtocolRooms', () => {
  describe('components[] data model', () => {
    it('keeps reportable conditions (Acceptabel, Skadad) and drops God', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'Skadad',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
          {
            componentId: 'c2',
            label: 'Kyl',
            condition: 'Acceptabel',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
          {
            componentId: 'c3',
            label: 'Diskmaskin',
            condition: 'God',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(2)
      expect(out.remarks.map((r) => r.buildingComponent)).toEqual([
        'Spis',
        'Kyl',
      ])
    })

    it('keeps a component with cost > 0 even if condition is God', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'God',
            action: [],
            note: '',
            photos: [],
            cost: 500,
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(1)
      expect(out.remarks[0].cost).toBe(500)
    })

    it('keeps a component with an action even if condition is God and cost is 0', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'God',
            action: ['Rengör'],
            note: '',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(1)
      expect(out.remarks[0].remarkStatus).toBe('Rengör')
    })

    it('keeps a component with only a note (condition God, no cost, no actions)', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'God',
            action: [],
            note: 'Repor',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(1)
      expect(out.remarks[0].notes).toBe('Repor')
    })

    it('drops empty / unknown conditions when no other reason to keep', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'X',
            condition: '',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
          {
            componentId: 'c2',
            label: 'Y',
            condition: 'OK',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(0)
    })

    it('case-insensitive reportable filter', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'X',
            condition: 'skadad',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
          {
            componentId: 'c2',
            label: 'Y',
            condition: ' ACCEPTABEL ',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(2)
    })
  })

  describe('mixed data models', () => {
    it('emits only component-sourced remarks even when fixed-key fields are present on input', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'Acceptabel',
            action: [],
            note: '',
            photos: [],
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      expect(out.remarks).toHaveLength(1)
      expect(out.remarks[0].buildingComponent).toBe('Spis')
    })
  })

  describe('all-OK rooms', () => {
    it('emits the room with empty remarks (renderer handles "Utan anmärkning")', () => {
      const [out] = mapInternalRoomsToProtocolRooms([baseRoom()], [])
      expect(out.remarks).toEqual([])
    })
  })

  describe('room label resolution', () => {
    it('uses the inline name on ad-hoc rooms', () => {
      const [out] = mapInternalRoomsToProtocolRooms(
        [baseRoom({ name: 'Källare' })],
        []
      )
      expect(out.room).toBe('Källare')
    })

    it('falls back to property-base name when ad-hoc name is missing', () => {
      const [out] = mapInternalRoomsToProtocolRooms(
        [baseRoom()],
        [propertyRoom({ id: 'room-1', name: 'Sovrum' })]
      )
      expect(out.room).toBe('Sovrum')
    })

    it('falls back to roomId when no name can be resolved', () => {
      const [out] = mapInternalRoomsToProtocolRooms(
        [baseRoom({ roomId: 'unknown-uuid' })],
        []
      )
      expect(out.room).toBe('unknown-uuid')
    })

    it('prefers ad-hoc name over property-base lookup', () => {
      const [out] = mapInternalRoomsToProtocolRooms(
        [baseRoom({ name: 'Vardagsrum' })],
        [propertyRoom({ id: 'room-1', name: 'IGNORED' })]
      )
      expect(out.room).toBe('Vardagsrum')
    })
  })

  describe('costResponsibility propagation', () => {
    it('carries tenant/landlord/null through from components[]', () => {
      const room = baseRoom({
        components: [
          {
            componentId: 'c1',
            label: 'Spis',
            condition: 'Skadad',
            action: [],
            note: '',
            photos: [],
            cost: 100,
            costResponsibility: 'tenant',
          },
          {
            componentId: 'c2',
            label: 'Kyl',
            condition: 'Skadad',
            action: [],
            note: '',
            photos: [],
            cost: 200,
            costResponsibility: 'landlord',
          },
          {
            componentId: 'c3',
            label: 'Diskmaskin',
            condition: 'Skadad',
            action: [],
            note: '',
            photos: [],
            cost: 300,
            costResponsibility: null,
          },
        ],
      })

      const [out] = mapInternalRoomsToProtocolRooms([room], [])
      const byLabel = Object.fromEntries(
        out.remarks.map((r) => [r.buildingComponent, r.costResponsibility])
      )
      expect(byLabel).toEqual({
        Spis: 'tenant',
        Kyl: 'landlord',
        Diskmaskin: null,
      })
    })
  })
})
