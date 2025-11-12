import {
  Contact,
  ContactCode,
  NationalIdNumber,
  PhoneNumber,
} from '@src/domain/contact'

export type ContactListParams = {
  filter: {
    wildcard?: string | string[]
  }
} & Pagination

export interface Pagination {
  page: number
  pageSize: number
}

export interface ContactsRepository {
  list: (params: ContactListParams) => Promise<Contact[]>
  getByContactCode: (contactCode: ContactCode) => Promise<Contact | null>
  // FIXME: These two should be listBy since there are no guarantee of uniqueness
  getByNationalIdNumber: (nid: NationalIdNumber) => Promise<Contact | null>
  getByPhoneNumber: (phoneNumber: PhoneNumber) => Promise<Contact | null>
}
