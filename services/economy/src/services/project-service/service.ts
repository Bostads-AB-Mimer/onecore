import { XledgerProject } from '@onecore/types'
import { getProjects as getXledgerProjects } from '../common/adapters/xledger-adapter'

export const getProjects = async (): Promise<XledgerProject[]> => {
  return getXledgerProjects()
}
