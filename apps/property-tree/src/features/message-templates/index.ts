// UI
export { ArchiveMessageTemplateDialog } from './ui/ArchiveMessageTemplateDialog'
export { MessageTemplateFormDialog } from './ui/MessageTemplateFormDialog'
export type { TemplateEditTarget } from './lib/editTarget'

// Hooks
export {
  useArchiveMessageTemplate,
  useCreateMessageTemplate,
  useRestoreMessageTemplate,
  useUpdateMessageTemplate,
} from './hooks/useMessageTemplateMutations'
export { useUpdateSystemTemplate } from './hooks/useSystemTemplateMutations'
