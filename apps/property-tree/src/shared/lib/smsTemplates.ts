// Picking a template replaces the message text. That is silent only when
// nothing the rep typed would be lost: an empty box, or text that is still
// exactly the previously applied template (so switching templates is free).
export const shouldConfirmTemplateReplace = (
  message: string,
  appliedTemplateBody: string | null
): boolean => message.trim() !== '' && message !== appliedTemplateBody
