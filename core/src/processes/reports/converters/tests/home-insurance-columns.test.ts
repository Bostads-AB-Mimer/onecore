import ExcelJs from 'exceljs'

import * as factory from '../../../../../test/factories'
import { convertHomeInsuranceToXlsx } from '../excelConverter'
import { HOME_INSURANCE_LF_COLUMNS } from '../home-insurance-columns'

describe(convertHomeInsuranceToXlsx, () => {
  it('writes the 18 Länsförsäkringar columns in their fixed order', async () => {
    const row = factory.homeInsuranceExportRow.build({
      leaseId: 'L-1',
      leaseFromDate: new Date('2023-01-01'),
      rowToDate: new Date('2023-12-31'),
      annualRent: 93,
      leaseStatus: '*',
    })

    const workbook = new ExcelJs.Workbook()
    // ExcelJS types its input as an ArrayBuffer, not Node's Buffer.
    const file = new Uint8Array(await convertHomeInsuranceToXlsx([row]))
    await workbook.xlsx.load(file.buffer)
    const worksheet = workbook.getWorksheet('Hemförsäkring')

    // ExcelJS rows are 1-based, with an empty first cell.
    expect(worksheet?.getRow(1).values).toEqual([
      undefined,
      'Kontraktsnummer',
      'Personnummer',
      'Namn',
      'Adress',
      'Postnr',
      'Ort',
      'Antal Rum',
      'Kvadratmeter',
      'Kontrakt Fr.o.m',
      'Kontrakt T.o.m',
      'Telefon',
      'E-post',
      'Hyresrad Fr.o.m',
      'Hyresrad T.o.m',
      'Årshyra',
      'Hyresobjekt, hyresid',
      'Status',
      'Avitext',
    ])
    expect(HOME_INSURANCE_LF_COLUMNS).toHaveLength(18)

    const values = worksheet?.getRow(2).values
    expect(Array.isArray(values) && values.slice(1)).toEqual([
      'L-1',
      row.nationalIdNumber,
      row.fullName,
      row.address,
      row.postalCode,
      row.city,
      row.numberOfRooms,
      row.squareMeters,
      '2023-01-01',
      // Empty cells read back as undefined.
      undefined,
      row.phoneNumber,
      undefined,
      '2023-01-01',
      '2023-12-31',
      93,
      row.rentalObjectCode,
      '*',
      row.articleText,
    ])
  })
})
