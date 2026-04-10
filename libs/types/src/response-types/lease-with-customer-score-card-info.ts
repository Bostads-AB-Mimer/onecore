import { z } from 'zod'

export const LeaseWithAdditionalCustomerScoreCardInfoSchema = z.object({
  //rental object info
  object_ref_nr: z.string(), //rentalObjectCode
  division_1011: z.string(), //districtCode
  object_real_estate: z.string(), //estate
  object_real_estate_year_construction: z.number().optional(), //buildingConstructionYear
  object_real_estate_year_reconstruction: z.number().optional(), //buildingRenovationYear
  real_estate_type: z.string(), //realEstateType
  division_1048: z.string(), //district
  division_1242: z.string(), //residentialArea/marketArea
  rentalTypeCode: z.string(),
  //contact info
  division_1501: z.string(), //contactCode
  respondent_name_first: z.string(), //contactFirstName
  respondent_name_last: z.string(), //contactLastName
  respondent_email: z.string(), //email
  respondent_phone: z.string(), //phoneNumber
  postal_street_1: z.string(), //address
  postal_street_2: z.string().optional(), //address2
  postal_zip: z.string(), //zipCode
  postal_city: z.string(), //city
  //lease info
  division_1038: z.string(), //leaseId
  division_1037: z.date().optional(), //contractDate
  contract_start_date: z.date(), //startDate
  contract_end_date: z.date().optional(), //endDate
  object_street_1: z.string(),
  object_zip: z.string(),
  object_city: z.string(),
})
