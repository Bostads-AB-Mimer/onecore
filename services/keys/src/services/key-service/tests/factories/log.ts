import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Log = keys.Log

/**
 * Factory for generating test Log entities.
 *
 * Usage:
 * - factory.log.build() - generates one log with defaults
 * - factory.log.build({ userName: 'custom@example.com' }) - override specific fields
 * - factory.log.buildList(5) - generates 5 logs
 */
export const LogFactory = Factory.define<Log>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  userName: `user${sequence}@example.com`,
  eventType: 'creation' as any, // DB enum: update, creation, delete
  eventTime: new Date(),
  objectType: 'key' as any, // DB enum: key_system, key, key_loan
  objectId: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  description: `Test log entry ${sequence}`,
  // Note: logs table does not have createdAt column
}))
