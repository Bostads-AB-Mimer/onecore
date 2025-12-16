import type { Inspection } from '@/components/residence/inspection/types'

// Mock data for temporary use until we have real data

// Extended inspection type for the overview page
// TODO should live elsewhere
export interface ExtendedInspection extends Inspection {
  contractId?: string
  address?: string
  terminationDate?: string
  district?: string
  inspectionNumber?: string
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

export const getAllInspections = (): ExtendedInspection[] => {
  // Always return mock data for demonstration purposes
  const mockInspections: ExtendedInspection[] = [
    {
      id: 'inspection-mock-1',
      date: '2024-09-20',
      inspectedBy: 'Anna Lindström',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024001',
      address: 'Storgatan 12',
      terminationDate: '2024-10-15',
      district: 'Centrum',
      inspectionNumber: 'BES-2024-001',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-10-16T10:00:00'),
      assignedInspector: 'Anna Lindström',
      tenantPhone: '070-123 45 67',
      masterKey: true,
    },
    {
      id: 'inspection-mock-2',
      date: '2024-09-22',
      inspectedBy: 'Erik Johansson',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024002',
      address: 'Lillgatan 8',
      terminationDate: '2024-10-20',
      district: 'Söder',
      inspectionNumber: 'BES-2024-002',
      priority: 'inflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-234 56 78',
      masterKey: false,
    },
    {
      id: 'inspection-mock-3',
      date: '2024-09-25',
      inspectedBy: 'Maria Andersson',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024003',
      address: 'Vasagatan 15',
      terminationDate: '2024-11-01',
      district: 'Norr',
      inspectionNumber: 'BES-2024-003',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-02T14:30:00'),
      assignedInspector: 'Maria Andersson',
      tenantPhone: '070-345 67 89',
      masterKey: true,
    },
    {
      id: 'inspection-mock-4',
      date: '2024-09-18',
      inspectedBy: 'Anna Lindström',
      rooms: {},
      isCompleted: true,
      contractId: 'K2024004',
      address: 'Kopparbergsvägen 22',
      terminationDate: '2024-09-30',
      district: 'Väster',
      inspectionNumber: 'BES-2024-004',
      priority: 'inflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-10-01T09:00:00'),
      assignedInspector: 'Anna Lindström',
      tenantPhone: '070-456 78 90',
      masterKey: false,
    },
    {
      id: 'inspection-mock-5',
      date: '2024-09-28',
      inspectedBy: 'Lars Petersson',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024005',
      address: 'Björkgatan 5',
      terminationDate: '2024-10-25',
      district: 'Öster',
      inspectionNumber: 'BES-2024-005',
      priority: 'avflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-567 89 01',
      masterKey: true,
    },
    {
      id: 'inspection-mock-6',
      date: '2024-09-15',
      inspectedBy: 'Anna Lindström',
      rooms: {},
      isCompleted: true,
      contractId: 'K2024006',
      address: 'Skolgatan 18',
      terminationDate: '2024-09-20',
      district: 'Centrum',
      inspectionNumber: 'BES-2024-006',
      priority: 'inflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-09-21T11:00:00'),
      assignedInspector: 'Anna Lindström',
      tenantPhone: '070-678 90 12',
      masterKey: false,
    },
    {
      id: 'inspection-mock-7',
      date: '2024-09-30',
      inspectedBy: 'Johanna Svensson',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024007',
      address: 'Hantverkargatan 9',
      terminationDate: '2024-11-10',
      district: 'Söder',
      inspectionNumber: 'BES-2024-007',
      priority: 'avflytt',
      isAssigned: true,
      scheduledDate: new Date('2024-11-11T13:00:00'),
      assignedInspector: 'Johanna Svensson',
      tenantPhone: '070-789 01 23',
      masterKey: true,
    },
    {
      id: 'inspection-mock-8',
      date: '2024-09-26',
      inspectedBy: 'Thomas Nilsson',
      rooms: {},
      isCompleted: false,
      contractId: 'K2024008',
      address: 'Klostergatan 14',
      terminationDate: '2024-10-30',
      district: 'Norr',
      inspectionNumber: 'BES-2024-008',
      priority: 'inflytt',
      isAssigned: false,
      scheduledDate: undefined,
      assignedInspector: undefined,
      tenantPhone: '070-890 12 34',
      masterKey: false,
    },
  ]

  return mockInspections
}
