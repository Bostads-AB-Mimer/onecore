import { Contact } from 'onecore-types'

export type ContactSearchData = Pick<Contact, 'contactCode' | 'fullName'>
