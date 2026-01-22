export const FULL_TEST_DATA_SET = [
  'P000040',
  'P000338',
  'P000851',
  'P001130',
  'P002505',
  'P002643',
  'P002949',
  'P002951',
  'P003492',
  'P003855',

  'F006629',
  'F006667',
  'F006671',
  'F006673',
  'F006688',
  'F006690',
  'P007378',
  'F009850',
  'P013702',
  'P017262',

  'F020420',
  'F022412',
  'F023327',
  'F024181',
  'F024647',
  'F025290',
  'F027243',
  'F027459',
  'F029530',

  'P041117',
  'F043876',
  'P047622',
  'F048277',
  'F055405',
  'F055428',
  'F055527',
  'P058261',
  'P058437',
  'P061055',
  'P061368',

  'P062949',
  'P066005',
  'F066461',
  'P070062',
  'P071294',
  'F072791',
  'P077105',
  '00082220',
  'K082412',
  'K082415',
  'K082417',

  '00085366',
  '00085367',
  'P104662',
  '00085369',
  'P170515',
  '00180981',
  'P181642',
  'P184660',
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
