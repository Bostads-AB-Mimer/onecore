import { z } from 'zod'

const ContactInfoSchema = z.object({
  contactCode: z.string(),
  name: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  address: z.string(),
  zipCode: z.string(),
  city: z.string(),
})

const RentalObjectInfoSchema = z.object({
  rentalObjectCode: z.string(),
  districtCode: z.string(),
  estate: z.string(),
  building: z.string(),
  district: z.string(),
})

export const LeaseWithContactAndRentalObjectInfoSchema = z.object({
  leaseId: z.string(),
  fromDate: z.date(),
  leaseAddress: z.string(),
  contact: ContactInfoSchema,
  rentalObjectInfo: RentalObjectInfoSchema,
})
