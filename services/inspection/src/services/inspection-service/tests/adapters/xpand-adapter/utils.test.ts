import {
  mapInspectionStatus,
  trimStrings,
  convertNumericBooleans,
} from '../../../adapters/xpand-adapter/utils'

describe('mapInspectionStatus', () => {
  it('should map known status codes to their string representations', () => {
    const inspections = [
      { id: '1', status: 0 },
      { id: '2', status: 1 },
      { id: '3', status: 3 },
      { id: '4', status: 6 },
    ]

    const result = mapInspectionStatus(inspections)

    expect(result).toEqual([
      { id: '1', status: 'Registrerad' },
      { id: '2', status: 'Genomförd' },
      { id: '3', status: 'Besiktningsresultat skickat' },
      { id: '4', status: 'Makulerad' },
    ])
  })

  it('should handle unknown status codes with fallback message', () => {
    const inspections = [
      { id: '1', status: 99 },
      { id: '2', status: -1 },
    ]

    const result = mapInspectionStatus(inspections)

    expect(result).toEqual([
      { id: '1', status: 'Unknown (99)' },
      { id: '2', status: 'Unknown (-1)' },
    ])
  })

  it('should preserve other properties in the inspection objects', () => {
    const inspections = [
      {
        id: 'INS001',
        status: 1,
        date: new Date('2023-01-01'),
        inspector: 'John Doe',
      },
    ]

    const result = mapInspectionStatus(inspections)

    expect(result).toEqual([
      {
        id: 'INS001',
        status: 'Genomförd',
        date: new Date('2023-01-01'),
        inspector: 'John Doe',
      },
    ])
  })

  it('should handle empty array', () => {
    const result = mapInspectionStatus([])
    expect(result).toEqual([])
  })
})

describe('trimStrings', () => {
  it('should trim string values', () => {
    const input = '  hello world  '
    const result = trimStrings(input)
    expect(result).toBe('hello world')
  })

  it('should trim strings in objects', () => {
    const input = {
      name: '  John Doe  ',
      address: '  123 Main St  ',
      age: 30,
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: 'John Doe',
      address: '123 Main St',
      age: 30,
    })
  })

  it('should trim strings in nested objects', () => {
    const input = {
      user: {
        name: '  Jane Smith  ',
        details: {
          email: '  jane@example.com  ',
        },
      },
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      user: {
        name: 'Jane Smith',
        details: {
          email: 'jane@example.com',
        },
      },
    })
  })

  it('should trim strings in arrays', () => {
    const input = ['  hello  ', '  world  ', '  test  ']
    const result = trimStrings(input)
    expect(result).toEqual(['hello', 'world', 'test'])
  })

  it('should trim strings in arrays of objects', () => {
    const input = [
      { name: '  Alice  ', role: '  Admin  ' },
      { name: '  Bob  ', role: '  User  ' },
    ]

    const result = trimStrings(input)

    expect(result).toEqual([
      { name: 'Alice', role: 'Admin' },
      { name: 'Bob', role: 'User' },
    ])
  })

  it('should preserve Date objects', () => {
    const date = new Date('2023-01-01T10:00:00Z')
    const input = {
      name: '  John  ',
      createdAt: date,
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: 'John',
      createdAt: date,
    })
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.createdAt).toBe(date)
  })

  it('should handle null values', () => {
    const input = {
      name: '  John  ',
      middleName: null,
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: 'John',
      middleName: null,
    })
  })

  it('should handle undefined values', () => {
    const input = {
      name: '  John  ',
      middleName: undefined,
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: 'John',
      middleName: undefined,
    })
  })

  it('should handle numbers, booleans, and other primitives', () => {
    const input = {
      name: '  John  ',
      age: 30,
      active: true,
      score: 95.5,
      count: 0,
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: 'John',
      age: 30,
      active: true,
      score: 95.5,
      count: 0,
    })
  })

  it('should handle empty strings', () => {
    const input = {
      name: '',
      title: '   ',
    }

    const result = trimStrings(input)

    expect(result).toEqual({
      name: '',
      title: '',
    })
  })

  it('should handle empty objects', () => {
    const input = {}
    const result = trimStrings(input)
    expect(result).toEqual({})
  })

  it('should handle empty arrays', () => {
    const input: string[] = []
    const result = trimStrings(input)
    expect(result).toEqual([])
  })
})

describe('convertNumericBooleans', () => {
  it('should convert specified numeric fields to booleans', () => {
    const data = {
      id: 'INS001',
      hasRemarks: 1,
      isActive: 1,
      count: 5,
    }

    const result = convertNumericBooleans(data, ['hasRemarks', 'isActive'])

    expect(result).toEqual({
      id: 'INS001',
      hasRemarks: true,
      isActive: true,
      count: 5,
    })
  })

  it('should convert 0 to false', () => {
    const data = {
      invoice: 0,
      isMissing: 0,
      workOrderCreated: 0,
    }

    const result = convertNumericBooleans(data, [
      'invoice',
      'isMissing',
      'workOrderCreated',
    ])

    expect(result).toEqual({
      invoice: false,
      isMissing: false,
      workOrderCreated: false,
    })
  })

  it('should convert 1 to true', () => {
    const data = {
      invoice: 1,
      isMissing: 1,
      workOrderCreated: 1,
    }

    const result = convertNumericBooleans(data, [
      'invoice',
      'isMissing',
      'workOrderCreated',
    ])

    expect(result).toEqual({
      invoice: true,
      isMissing: true,
      workOrderCreated: true,
    })
  })

  it('should only convert specified fields', () => {
    const data = {
      hasRemarks: 1,
      isActive: 1,
      count: 1,
    }

    const result = convertNumericBooleans(data, ['hasRemarks'])

    expect(result).toEqual({
      hasRemarks: true,
      isActive: 1,
      count: 1,
    })
  })

  it('should handle empty fields array', () => {
    const data = {
      hasRemarks: 1,
      isActive: 1,
    }

    const result = convertNumericBooleans(data, [])

    expect(result).toEqual({
      hasRemarks: 1,
      isActive: 1,
    })
  })

  it('should handle fields that do not exist in data', () => {
    const data = {
      hasRemarks: 1,
    }

    const result = convertNumericBooleans(data, [
      'hasRemarks',
      'nonExistent' as any,
    ])

    expect(result).toEqual({
      hasRemarks: true,
    })
  })

  it('should not mutate the original object', () => {
    const data = {
      hasRemarks: 1,
      isActive: 0,
    }

    const result = convertNumericBooleans(data, ['hasRemarks', 'isActive'])

    expect(data).toEqual({
      hasRemarks: 1,
      isActive: 0,
    })
    expect(result).toEqual({
      hasRemarks: true,
      isActive: false,
    })
  })

  it('should handle other truthy/falsy numeric values', () => {
    const data = {
      field1: 2,
      field2: -1,
      field3: 0,
      field4: 100,
    }

    const result = convertNumericBooleans(data, [
      'field1',
      'field2',
      'field3',
      'field4',
    ])

    expect(result).toEqual({
      field1: true,
      field2: true,
      field3: false,
      field4: true,
    })
  })

  it('should preserve other property types', () => {
    const data = {
      id: 'INS001',
      hasRemarks: 1,
      notes: 'Some notes',
      date: new Date('2023-01-01'),
      count: 5,
    }

    const result = convertNumericBooleans(data, ['hasRemarks'])

    expect(result).toEqual({
      id: 'INS001',
      hasRemarks: true,
      notes: 'Some notes',
      date: new Date('2023-01-01'),
      count: 5,
    })
  })
})
