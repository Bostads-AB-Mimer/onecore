import type { MessageTemplate } from '@/entities/message-template'
import type { SystemTemplate } from '@/entities/system-template'

/** What the editor edits: an SMS template (null = a new one) or a system email. */
export type TemplateEditTarget =
  | { kind: 'sms'; template: MessageTemplate | null }
  | { kind: 'system'; template: SystemTemplate }
