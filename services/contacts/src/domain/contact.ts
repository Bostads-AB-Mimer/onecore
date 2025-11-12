import z from 'zod'
import { ContactSchema } from '@src/services/contacts-service/schema'

export type ContactCode = string
export type PhoneNumber = string
export type NationalIdNumber = string

export type Contact = z.infer<typeof ContactSchema>
