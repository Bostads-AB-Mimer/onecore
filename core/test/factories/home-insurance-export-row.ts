import { Factory } from 'fishery'
import { schemas } from '@onecore/types'

type HomeInsuranceExportRow = schemas.v1.HomeInsuranceExportRow

export const HomeInsuranceExportRowFactory =
  Factory.define<HomeInsuranceExportRow>(({ sequence }) => ({
    leaseId: `lease-${sequence}`,
    leaseStatus: 'G',
    leaseFromDate: new Date('2023-01-01'),
    leaseToDate: null,
    rentalObjectCode: `RO-${sequence}`,
    numberOfRooms: 3,
    squareMeters: 75,
    rowFromDate: new Date('2023-01-01'),
    rowToDate: null,
    annualRent: 1200,
    articleText: 'Mimers Hemförsäkring',
    nationalIdNumber: `19900101${sequence.toString().padStart(4, '0')}`,
    fullName: `Svensson Anna`,
    address: 'Storgatan 1',
    phoneNumber: '0701234567',
    email: null,
  }))
