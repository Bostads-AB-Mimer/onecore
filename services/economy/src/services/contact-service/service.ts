import { XledgerContact } from '@onecore/types'
import { getContacts as getXledgerContacts } from '../common/adapters/xledger-adapter'

export const getContacts = async (): Promise<XledgerContact[]> => {
  return getXledgerContacts()
}
