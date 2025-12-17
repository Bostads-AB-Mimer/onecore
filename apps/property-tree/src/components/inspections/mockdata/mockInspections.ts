import type {
  Inspection,
  ResidenceInfo,
} from '@/components/residence/inspection/types'

// Mock data for temporary use until we have real data

// Extended inspection type for the overview page
// TODO should live elsewhere
export interface ExtendedInspection extends Inspection {
  contractId?: string
  address?: string
  terminationDate?: string
  district?: string
  priority?: 'avflytt' | 'inflytt'
  isAssigned?: boolean
  scheduledDate?: Date
  assignedInspector?: string
  tenantPhone?: string
  masterKey?: boolean
}

// Available inspectors for assignment
export const AVAILABLE_INSPECTORS = [
  'Anna Lindström',
  'Erik Johansson',
  'Maria Andersson',
  'Lars Petersson',
  'Johanna Svensson',
  'Thomas Nilsson',
]

// Mock current user - in real app this would come from auth context
export const CURRENT_USER = 'Anna Lindström'

// Helper to create mock residence info
const createMockResidence = (address: string, id: string): ResidenceInfo => ({
  id,
  objectNumber: `LGH-${id.slice(-3)}`,
  address,
  apartmentType: 'Standard',
  size: 65,
})

// Helper to create empty room inspection data
const createEmptyRoomData = (roomId: string) => ({
  roomId,
  conditions: {
    wall1: '',
    wall2: '',
    wall3: '',
    wall4: '',
    floor: '',
    ceiling: '',
    details: '',
  },
  actions: {
    wall1: [],
    wall2: [],
    wall3: [],
    wall4: [],
    floor: [],
    ceiling: [],
    details: [],
  },
  componentNotes: {
    wall1: '',
    wall2: '',
    wall3: '',
    wall4: '',
    floor: '',
    ceiling: '',
    details: '',
  },
  componentPhotos: {
    wall1: [],
    wall2: [],
    wall3: [],
    wall4: [],
    floor: [],
    ceiling: [],
    details: [],
  },
  photos: [],
  isApproved: false,
  isHandled: false,
})

// Helper to create partial room inspection data (for drafts)
const createPartialRoomData = (
  roomId: string,
  conditions: Partial<Record<string, string>>
) => ({
  ...createEmptyRoomData(roomId),
  conditions: {
    wall1: conditions.wall1 || '',
    wall2: conditions.wall2 || '',
    wall3: conditions.wall3 || '',
    wall4: conditions.wall4 || '',
    floor: conditions.floor || '',
    ceiling: conditions.ceiling || '',
    details: conditions.details || '',
  },
  isHandled:
    Object.values(conditions).filter((v) => v && v.trim() !== '').length >= 7,
})

export const getAllInspections = (): ExtendedInspection[] => {
  const mockInspections: ExtendedInspection[] = [
    // === COMPLETED (2 st) ===
    {
      id: 'inspection-completed-1',
      inspectionNumber: 'BES-2024-001',
      date: '2024-09-15',
      inspectedBy: 'Anna Lindström',
      rooms: {
        'room-hall': createPartialRoomData('room-hall', {
          wall1: 'God',
          wall2: 'God',
          wall3: 'God',
          wall4: 'God',
          floor: 'God',
          ceiling: 'God',
          details: 'God',
        }),
        'room-kok': createPartialRoomData('room-kok', {
          wall1: 'Acceptabel',
          wall2: 'Acceptabel',
          wall3: 'God',
          wall4: 'God',
          floor: 'Acceptabel',
          ceiling: 'God',
          details: 'God',
        }),
      },
      status: 'completed',
      isCompleted: true,
      residence: createMockResidence('Skolgatan 18', 'res-001'),
      needsMasterKey: false,
      contractId: 'K2024001',
      address: 'Skolgatan 18',
      terminationDate: '2024-09-20',
      district: 'Centrum',
      priority: 'inflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-09-21T11:00:00'),
      assignedInspector: 'Anna Lindström',
      tenantPhone: '070-678 90 12',
      masterKey: false,
    },
    {
      id: 'inspection-completed-2',
      inspectionNumber: 'BES-2024-002',
      date: '2024-09-18',
      inspectedBy: 'Maria Andersson',
      rooms: {
        'room-hall': createPartialRoomData('room-hall', {
          wall1: 'God',
          wall2: 'God',
          wall3: 'God',
          wall4: 'God',
          floor: 'God',
          ceiling: 'God',
          details: 'God',
        }),
      },
      status: 'completed',
      isCompleted: true,
      residence: createMockResidence('Kopparbergsvägen 22', 'res-002'),
      needsMasterKey: false,
      contractId: 'K2024002',
      address: 'Kopparbergsvägen 22',
      terminationDate: '2024-09-30',
      district: 'Väster',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-10-01T09:00:00'),
      assignedInspector: 'Maria Andersson',
      tenantPhone: '070-456 78 90',
      masterKey: false,
    },

    // === IN PROGRESS (2 st) - har påbörjad rumsdata ===
    {
      id: 'inspection-inprogress-1',
      inspectionNumber: 'BES-2024-003',
      date: '2024-09-20',
      inspectedBy: 'Anna Lindström',
      rooms: {
        'room-hall': createPartialRoomData('room-hall', {
          wall1: 'God',
          wall2: 'God',
          floor: 'Acceptabel',
          ceiling: 'God',
        }),
        'room-kok': createPartialRoomData('room-kok', {
          wall1: 'Skadad',
          floor: 'Acceptabel',
        }),
      },
      status: 'in_progress',
      isCompleted: false,
      residence: createMockResidence('Storgatan 12', 'res-003'),
      needsMasterKey: true,
      contractId: 'K2024003',
      address: 'Storgatan 12',
      terminationDate: '2024-10-15',
      district: 'Centrum',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-10-16T10:00:00'),
      assignedInspector: 'Anna Lindström',
      tenantPhone: '070-123 45 67',
      masterKey: true,
    },
    {
      id: 'inspection-inprogress-2',
      inspectionNumber: 'BES-2024-004',
      date: '2024-09-30',
      inspectedBy: 'Johanna Svensson',
      rooms: {
        'room-badrum': createPartialRoomData('room-badrum', {
          wall1: 'Skadad',
          floor: 'Skadad',
        }),
      },
      status: 'in_progress',
      isCompleted: false,
      residence: createMockResidence('Hantverkargatan 9', 'res-004'),
      needsMasterKey: true,
      contractId: 'K2024004',
      address: 'Hantverkargatan 9',
      terminationDate: '2024-11-10',
      district: 'Söder',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-11T13:00:00'),
      assignedInspector: 'Johanna Svensson',
      tenantPhone: '070-789 01 23',
      masterKey: true,
    },

    // === DRAFT (2 st) - sparad men inte färdig ===
    {
      id: 'inspection-draft-1',
      inspectionNumber: 'BES-2024-005',
      date: '2024-09-25',
      inspectedBy: 'Maria Andersson',
      rooms: {
        'room-hall': createPartialRoomData('room-hall', {
          wall1: 'God',
          wall2: 'God',
          wall3: 'God',
          wall4: 'God',
          floor: 'God',
          ceiling: 'God',
          details: 'God',
        }),
        'room-vardagsrum': createPartialRoomData('room-vardagsrum', {
          wall1: 'Acceptabel',
        }),
      },
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Vasagatan 15', 'res-005'),
      needsMasterKey: true,
      contractId: 'K2024005',
      address: 'Vasagatan 15',
      terminationDate: '2024-11-01',
      district: 'Norr',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-02T14:30:00'),
      assignedInspector: 'Maria Andersson',
      tenantPhone: '070-345 67 89',
      masterKey: true,
    },
    {
      id: 'inspection-draft-2',
      inspectionNumber: 'BES-2024-006',
      date: '2024-10-01',
      inspectedBy: 'Erik Johansson',
      rooms: {
        'room-sovrum': createPartialRoomData('room-sovrum', {
          wall1: 'God',
          floor: 'God',
        }),
      },
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Kungsgatan 5', 'res-006'),
      needsMasterKey: false,
      contractId: 'K2024006',
      address: 'Kungsgatan 5',
      terminationDate: '2024-11-15',
      district: 'Centrum',
      priority: 'inflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-16T09:00:00'),
      assignedInspector: 'Erik Johansson',
      tenantPhone: '070-111 22 33',
      masterKey: false,
    },

    // === EJ PÅBÖRJAD (4 st) - inga rum, ingen rumsdata ===
    {
      id: 'inspection-notstarted-1',
      inspectionNumber: 'BES-2024-007',
      date: '2024-09-22',
      inspectedBy: '',
      rooms: {},
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Lillgatan 8', 'res-007'),
      needsMasterKey: false,
      contractId: 'K2024007',
      address: 'Lillgatan 8',
      terminationDate: '2024-10-20',
      district: 'Söder',
      priority: 'inflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-234 56 78',
      masterKey: false,
    },
    {
      id: 'inspection-notstarted-2',
      inspectionNumber: 'BES-2024-008',
      date: '2024-09-28',
      inspectedBy: '',
      rooms: {},
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Björkgatan 5', 'res-008'),
      needsMasterKey: true,
      contractId: 'K2024008',
      address: 'Björkgatan 5',
      terminationDate: '2024-10-25',
      district: 'Öster',
      priority: 'avflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-567 89 01',
      masterKey: true,
    },
    {
      id: 'inspection-notstarted-3',
      inspectionNumber: 'BES-2024-009',
      date: '2024-09-26',
      inspectedBy: '',
      rooms: {},
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Klostergatan 14', 'res-009'),
      needsMasterKey: false,
      contractId: 'K2024009',
      address: 'Klostergatan 14',
      terminationDate: '2024-10-30',
      district: 'Norr',
      priority: 'inflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-890 12 34',
      masterKey: false,
    },
    {
      id: 'inspection-notstarted-4',
      inspectionNumber: 'BES-2024-010',
      date: '2024-10-02',
      inspectedBy: '',
      rooms: {},
      status: 'draft',
      isCompleted: false,
      residence: createMockResidence('Parkvägen 22', 'res-010'),
      needsMasterKey: true,
      contractId: 'K2024010',
      address: 'Parkvägen 22',
      terminationDate: '2024-11-20',
      district: 'Väster',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-21T08:00:00'),
      assignedInspector: 'Lars Petersson',
      tenantPhone: '070-999 88 77',
      masterKey: true,
    },
  ]

  return mockInspections
}
