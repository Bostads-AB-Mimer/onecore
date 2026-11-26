// Type definitions for Infobip v4 Email API
export interface EmailV4Destination {
  destination: string
  placeholders?: string
}

export interface EmailV4Message {
  sender: string
  destinations: Array<{
    to: EmailV4Destination[]
  }>
  content: { subject: string; text: string; html?: string }
}

export interface EmailV4Response {
  messages?: Array<{
    messageId: string
    to: string
    status: {
      groupId: number
      groupName: string
      id: number
      name: string
      description: string
    }
  }>
}
