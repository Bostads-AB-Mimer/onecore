// Realm role in the JWT's realm_access.roles. Gates release note writes; the
// FE reads the same flag from the GET /release-notes capabilities response.
export const RELEASE_NOTES_WRITE_ROLE = 'release-notes:write'

// Realm role that may edit the system email templates (live at once for every
// following send). Everyone logged in may read them.
export const SYSTEM_MESSAGE_TEMPLATES_WRITE_ROLE =
  'system-message-templates:write'
