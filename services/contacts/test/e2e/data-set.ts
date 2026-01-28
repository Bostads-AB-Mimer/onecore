export const FULL_TEST_DATA_SET = [
  'P000111',
  'P000222',
  'P000333',
  'P000444',
  'P000555',
  'P000666',
  'P000777',
  'P000888',
  'P000999',
  'P001000',
  'P002000',
  'F111111',
  'F111222',
  'F111333',
  'F111444',
]

export const filterDataSet = (
  dataSet: string[],
  filter: { type?: 'individual' | 'organisation' }
) => {
  return dataSet.filter((cc) => {
    if (filter.type === 'individual') {
      if (!cc.startsWith('P')) return false
    } else if (filter.type === 'organisation') {
      if (!['F', 'I', 'K', 'O', 'Ö'].includes(cc.charAt(0))) return false
    }
    return true
  })
}
