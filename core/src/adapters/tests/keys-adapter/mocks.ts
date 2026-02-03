import { keys } from '@onecore/types'

type Key = keys.v1.Key
type KeySystem = keys.v1.KeySystem
type PaginatedResponse<T> = keys.v1.PaginatedResponse<T>

// Note: Dates are ISO strings as they come from HTTP responses
export const mockedKey: any = {
  id: '00000000-0000-0000-0000-000000000001',
  keyName: 'Test Key',
  keySequenceNumber: 1,
  flexNumber: 1,
  rentalObjectCode: '123-456-789/1',
  keyType: 'LGH',
  keySystemId: '00000000-0000-0000-0000-000000000001',
  disposed: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

export const mockedKeySystem: any = {
  id: '00000000-0000-0000-0000-000000000001',
  systemCode: 'SYS-001',
  name: 'Test System',
  manufacturer: 'ASSA ABLOY',
  managingSupplier: 'Supplier AB',
  type: 'MECHANICAL',
  propertyIds: JSON.stringify(['property-1']),
  installationDate: '2020-01-01T00:00:00.000Z',
  isActive: true,
  description: 'Test key system',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'test-user@mimer.nu',
  updatedBy: null,
}

export const mockedPaginatedKeys: PaginatedResponse<Key> = {
  content: [mockedKey],
  _meta: {
    totalRecords: 1,
    page: 1,
    limit: 20,
    count: 1,
  },
  _links: [
    { href: '/keys?page=1&limit=20', rel: 'self' },
    { href: '/keys?page=1&limit=20', rel: 'first' },
    { href: '/keys?page=1&limit=20', rel: 'last' },
  ],
}

export const mockedPaginatedKeySystems: PaginatedResponse<KeySystem> = {
  content: [mockedKeySystem],
  _meta: {
    totalRecords: 1,
    page: 1,
    limit: 20,
    count: 1,
  },
  _links: [
    { href: '/key-systems?page=1&limit=20', rel: 'self' },
    { href: '/key-systems?page=1&limit=20', rel: 'first' },
    { href: '/key-systems?page=1&limit=20', rel: 'last' },
  ],
}

export const mockedKeyLoan: any = {
  id: '00000000-0000-0000-0000-000000000001',
  keys: JSON.stringify(['00000000-0000-0000-0000-000000000001']),
  contact: 'P123456',
  contact2: undefined,
  returnedAt: null,
  availableToNextTenantFrom: null,
  pickedUpAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'test-user@mimer.nu',
  updatedBy: null,
}

export const mockedLog: any = {
  id: '00000000-0000-0000-0000-000000000001',
  userName: 'test-user@mimer.nu',
  eventType: 'creation',
  objectType: 'key',
  objectId: '00000000-0000-0000-0000-000000000001',
  eventTime: '2024-01-01T00:00:00.000Z',
  description: 'Created new key',
}

export const mockedReceipt: any = {
  id: '00000000-0000-0000-0000-000000000001',
  keyLoanId: '00000000-0000-0000-0000-000000000001',
  loanType: 'REGULAR',
  receiptType: 'LOAN',
  type: 'DIGITAL',
  fileId: 'file-123',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

export const mockedKeyNote: any = {
  id: '00000000-0000-0000-0000-000000000001',
  rentalObjectCode: '123-456-789/1',
  description: 'Important note about keys',
}

export const mockedKeyEvent: any = {
  id: '00000000-0000-0000-0000-000000000001',
  keys: JSON.stringify(['00000000-0000-0000-0000-000000000001']),
  type: 'FLEX',
  status: 'COMPLETED',
  workOrderId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}
