import { SYSTEM_EMAIL_FIXTURES } from './system-email-fixtures'
import {
  SYSTEM_TEMPLATE_PLACEHOLDERS,
  SystemTemplateKey,
} from './system-templates'
import type { TemplateRules } from './validation'

/** What a system template may contain, and the values its test render uses. */
export const systemTemplateRules = (key: SystemTemplateKey): TemplateRules => ({
  placeholders: SYSTEM_TEMPLATE_PLACEHOLDERS[key],
  examples: SYSTEM_EMAIL_FIXTURES[key],
})
