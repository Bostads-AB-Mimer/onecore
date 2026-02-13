import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Log = keys.v1.Log

export const LogFactory = Factory.define<Log>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  userName: 'test-user@mimer.nu',
  eventType: 'creation',
  objectType: 'key',
  objectId: '00000000-0000-0000-0000-000000000001',
  eventTime: new Date(),
  description: `Log entry ${sequence}`,
}))
