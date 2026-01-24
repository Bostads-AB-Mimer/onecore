export type DbContact = {
  contactCode: string
  contactKey: string
  objectKey: string
  nid: string
  firstName: string | undefined
  lastName: string | undefined
  fullName: string
  birthDate: string
  street: string
  postalCode: string
  city: string
  protectedIdentity: string | undefined
  specialAttention: string | undefined
  trusteeId: string | undefined
  trusteeName: string | undefined
}

export type DbPhoneNumber = {
  phoneId: string
  ownerObjectKey: string
  phoneNumber: string
  phoneType: string
  isPrimaryPhone: number
}

export type DbEmailAddress = {
  emailId: string
  ownerObjectKey: string
  emailAddress: string
  emailType: string
  isPrimaryEmail: number
}

export type DbAddress = {
  addressId: string
  adress1?: string
  adress2?: string
  adress3?: string
  adress4?: string
  adress5?: string
  adress6?: string
  adress7?: string
  adress8?: string
  adress9?: string
  adress10?: string
  region?: string
}

export type DbContactRow = DbContact &
  Partial<DbPhoneNumber> &
  Partial<DbEmailAddress> &
  Partial<DbAddress>

export type DbContactDetails = {
  phoneNumbers: DbPhoneNumber[]
  emailAddresses: DbEmailAddress[]
  addresses: DbAddress[]
}

export type DbContactDetailsMap = Record<string, DbContactDetails>
