export type ContactDetailsMode = 'real' | 'placeholder' | 'redacted'

export const contactDetailsMode = (
  env: NodeJS.ProcessEnv = process.env
): ContactDetailsMode => {
  const mode = env.CONTACT_DETAILS__MODE
  if (mode === undefined || mode === '') {
    return env.NODE_ENV === 'production' ? 'real' : 'redacted'
  }
  if (mode === 'real' || mode === 'placeholder' || mode === 'redacted') {
    return mode
  }
  return 'redacted'
}

export const placeholderEmailAddress = (contactCode: string): string =>
  `redacted+${contactCode.trim()}@example.invalid`

// FNV-1a 32-bit
const hash = (value: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

// 070-174 06 05..99 is the PTS block reserved for fiction
export const placeholderPhoneNumber = (contactCode: string): string => {
  const suffix = 5 + (hash(contactCode.trim()) % 95)
  return `070-174 06 ${String(suffix).padStart(2, '0')}`
}
