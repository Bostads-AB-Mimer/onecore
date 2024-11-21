import {
  Apartment,
  NavigationItem,
  Area,
  Property,
  Building,
  Entrance,
  Room,
  Issue,
} from './types'

export const mockActiveIssues: Record<string, Issue[]> = {
  '101': [
    {
      id: 'issue-1',
      date: '2024-02-15',
      description: 'Onormalt ljud från diskmaskin',
      status: 'in-progress',
      priority: 'medium',
      category: 'repair',
      feature: 'Diskmaskin',
      room: 'Kök',
    },
    {
      id: 'issue-2',
      date: '2024-02-10',
      description: 'Mindre repor i parkettgolv',
      status: 'pending',
      priority: 'low',
      category: 'maintenance',
      feature: 'Parkettgolv',
      room: 'Vardagsrum',
    },
  ],
  '201': [
    {
      id: 'issue-3',
      date: '2024-02-18',
      description: 'Droppande kran',
      status: 'pending',
      priority: 'medium',
      category: 'repair',
      feature: 'Blandare',
      room: 'Kök',
    },
  ],
  '202': [
    {
      id: 'issue-4',
      date: '2024-02-20',
      description: 'Trasig termostat i badrum',
      status: 'pending',
      priority: 'high',
      category: 'repair',
      feature: 'Golvvärme',
      room: 'Badrum',
    },
  ],
}

export const mockRooms: Record<string, Room[]> = {
  '101': [
    {
      id: '101-1',
      name: 'Vardagsrum',
      type: 'living',
      size: 25,
      windows: 2,
      features: ['Parkettgolv', 'Balkong', 'Öppen planlösning'],
    },
    {
      id: '101-2',
      name: 'Sovrum 1',
      type: 'bedroom',
      size: 15,
      windows: 1,
      features: ['Garderob', 'Parkettgolv'],
    },
    {
      id: '101-3',
      name: 'Sovrum 2',
      type: 'bedroom',
      size: 12,
      windows: 1,
      features: ['Garderob', 'Parkettgolv'],
    },
    {
      id: '101-4',
      name: 'Kök',
      type: 'kitchen',
      size: 15,
      windows: 1,
      features: ['Diskmaskin', 'Induktionshäll', 'Mikrovågsugn'],
    },
    {
      id: '101-5',
      name: 'Badrum',
      type: 'bathroom',
      size: 8,
      windows: 0,
      features: ['Tvättmaskin', 'Torktumlare', 'Golvvärme'],
    },
  ],
  '201': [
    {
      id: '201-1',
      name: 'Vardagsrum',
      type: 'living',
      size: 28,
      windows: 2,
      features: ['Parkettgolv', 'Balkong', 'Öppen planlösning'],
    },
    {
      id: '201-2',
      name: 'Sovrum 1',
      type: 'bedroom',
      size: 16,
      windows: 1,
      features: ['Garderob', 'Parkettgolv'],
    },
    {
      id: '201-3',
      name: 'Sovrum 2',
      type: 'bedroom',
      size: 14,
      windows: 1,
      features: ['Garderob', 'Parkettgolv'],
    },
    {
      id: '201-4',
      name: 'Kök',
      type: 'kitchen',
      size: 16,
      windows: 1,
      features: ['Diskmaskin', 'Induktionshäll', 'Mikrovågsugn'],
    },
    {
      id: '201-5',
      name: 'Badrum',
      type: 'bathroom',
      size: 8,
      windows: 0,
      features: ['Tvättmaskin', 'Torktumlare', 'Golvvärme'],
    },
  ],
  '202': [
    {
      id: '202-1',
      name: 'Vardagsrum',
      type: 'living',
      size: 22,
      windows: 2,
      features: ['Parkettgolv', 'Balkong'],
    },
    {
      id: '202-2',
      name: 'Sovrum',
      type: 'bedroom',
      size: 14,
      windows: 1,
      features: ['Garderob', 'Parkettgolv'],
    },
    {
      id: '202-3',
      name: 'Kök',
      type: 'kitchen',
      size: 12,
      windows: 1,
      features: ['Diskmaskin', 'Induktionshäll'],
    },
    {
      id: '202-4',
      name: 'Badrum',
      type: 'bathroom',
      size: 6,
      windows: 0,
      features: ['Tvättmaskin', 'Golvvärme'],
    },
  ],
}

export const mockNavigation: NavigationItem[] = [
  {
    id: 'vasteras',
    name: 'Västerås',
    type: 'area',
    children: [
      {
        id: 'storgatan',
        name: 'Storgatan',
        type: 'property',
        children: [
          {
            id: 'building-1',
            name: 'Hus A',
            type: 'building',
            children: [
              {
                id: 'entrance-1',
                name: 'Uppgång 1',
                type: 'entrance',
                children: [
                  { id: '101', name: 'Lägenhet 101', type: 'apartment' },
                  { id: '102', name: 'Lägenhet 102', type: 'apartment' },
                ],
              },
              {
                id: 'entrance-2',
                name: 'Uppgång 2',
                type: 'entrance',
                children: [
                  { id: '201', name: 'Lägenhet 201', type: 'apartment' },
                  { id: '202', name: 'Lägenhet 202', type: 'apartment' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export const mockAreas: Record<string, Area> = {
  vasteras: {
    id: 'vasteras',
    name: 'Västerås',
    properties: ['storgatan'],
    totalApartments: 12,
    occupiedApartments: 10,
    totalProperties: 1,
  },
}

export const mockProperties: Record<string, Property> = {
  storgatan: {
    id: 'storgatan',
    name: 'Storgatan',
    address: 'Storgatan 1, Västerås',
    areaId: 'vasteras',
    buildings: ['building-1'],
    totalApartments: 8,
    occupiedApartments: 7,
    constructionYear: 1985,
    lastRenovation: 2015,
  },
}

export const mockBuildings: Record<string, Building> = {
  'building-1': {
    id: 'building-1',
    name: 'Hus A',
    propertyId: 'storgatan',
    entrances: ['entrance-1', 'entrance-2'],
    totalApartments: 8,
    occupiedApartments: 7,
  },
}

export const mockEntrances: Record<string, Entrance> = {
  'entrance-1': {
    id: 'entrance-1',
    name: 'Uppgång 1',
    buildingId: 'building-1',
    apartments: ['101', '102'],
    totalApartments: 4,
    occupiedApartments: 4,
  },
  'entrance-2': {
    id: 'entrance-2',
    name: 'Uppgång 2',
    buildingId: 'building-1',
    apartments: ['201', '202'],
    totalApartments: 4,
    occupiedApartments: 3,
  },
}

export const mockApartments: Record<string, Apartment> = {
  '101': {
    id: '101',
    name: 'Lägenhet 101',
    address: 'Storgatan 1, Västerås',
    size: 75,
    bedrooms: 3,
    rent: 10000,
    entranceId: 'entrance-1',
    tenant: {
      id: 'tenant-1',
      name: 'Anna Svensson',
      email: 'anna.svensson@example.com',
      phone: '070-123 45 67',
      moveInDate: '2021-01-01',
      apartmentId: '101',
    },
    rooms: mockRooms['101'],
    activeIssues: mockActiveIssues['101'],
  },
  '201': {
    id: '201',
    name: 'Lägenhet 201',
    address: 'Storgatan 1, Västerås',
    size: 82,
    bedrooms: 3,
    rent: 11000,
    entranceId: 'entrance-2',
    tenant: {
      id: 'tenant-3',
      name: 'Johan Nilsson',
      email: 'johan.nilsson@example.com',
      phone: '070-555 66 77',
      moveInDate: '2022-08-01',
      apartmentId: '201',
    },
    rooms: mockRooms['201'],
    activeIssues: mockActiveIssues['201'],
  },
  '202': {
    id: '202',
    name: 'Lägenhet 202',
    address: 'Storgatan 1, Västerås',
    size: 54,
    bedrooms: 2,
    rent: 8500,
    entranceId: 'entrance-2',
    tenant: {
      id: 'tenant-4',
      name: 'Maria Larsson',
      email: 'maria.larsson@example.com',
      phone: '070-888 99 00',
      moveInDate: '2023-03-15',
      apartmentId: '202',
    },
    rooms: mockRooms['202'],
    activeIssues: mockActiveIssues['202'],
  },
}
