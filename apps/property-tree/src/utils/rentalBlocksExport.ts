import { ExcelColumn, exportToExcel } from '@/utils/excelExport'
import { RentalBlockWithResidence } from '@/services/api/core/residenceService'

const formatDate = (isoDate: string | null): string => {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString('sv-SE')
}

const rentalBlocksColumns: ExcelColumn<RentalBlockWithResidence>[] = [
  {
    header: 'Hyresobjekt',
    key: 'hyresobjekt',
    getValue: (block) =>
      block.rentalObject?.rentalId || block.rentalObject?.code || '',
  },
  {
    header: 'Kategori',
    key: 'kategori',
    getValue: (block) => block.rentalObject?.category || '',
  },
  {
    header: 'Typ',
    key: 'typ',
    getValue: (block) => block.rentalObject?.type || '',
  },
  {
    header: 'Adress',
    key: 'adress',
    getValue: (block) => block.rentalObject?.address || '',
    width: 30,
  },
  {
    header: 'Fastighet',
    key: 'fastighet',
    getValue: (block) => block.property?.name || '',
  },
  {
    header: 'Orsak',
    key: 'orsak',
    getValue: (block) => block.blockReason || '',
  },
  {
    header: 'Startdatum',
    key: 'startdatum',
    getValue: (block) => formatDate(block.fromDate),
  },
  {
    header: 'Slutdatum',
    key: 'slutdatum',
    getValue: (block) => formatDate(block.toDate),
  },
  {
    header: 'Hyra (kr/mån)',
    key: 'hyra',
    getValue: (block) =>
      block.rentalObject?.monthlyRent
        ? Math.round(block.rentalObject.monthlyRent)
        : null,
  },
  {
    header: 'Estimerat Hyresbortfall (kr)',
    key: 'hyresbortfall',
    getValue: (block) => block.amount ?? null,
  },
]

export async function exportRentalBlocksToExcel(
  data: RentalBlockWithResidence[]
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `sparrlista-${timestamp}`

  await exportToExcel(data, rentalBlocksColumns, filename, 'Spärrlista')
}
