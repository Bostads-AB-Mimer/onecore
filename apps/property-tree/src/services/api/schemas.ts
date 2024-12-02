import { z } from 'zod'

// Base schemas
export const IssueSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  status: z.enum(['resolved', 'pending', 'in-progress']),
  priority: z.enum(['low', 'medium', 'high']),
  category: z.enum(['maintenance', 'repair', 'replacement']),
  feature: z.string(),
  room: z.string()
})

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  moveInDate: z.string(),
  residenceId: z.string()
})

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['bedroom', 'kitchen', 'bathroom', 'living', 'other']),
  size: z.number(),
  windows: z.number(),
  features: z.array(z.string())
})

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['appliance', 'fixture', 'furniture', 'other']),
  category: z.string(),
  installationDate: z.string(),
  warranty: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  lastService: z.string().optional(),
  nextService: z.string().optional(),
  status: z.enum(['operational', 'needs-service', 'broken']),
  room: z.string(),
  issues: z.array(IssueSchema)
})

export const ResidenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  size: z.number(),
  bedrooms: z.number(),
  rent: z.number(),
  tenant: TenantSchema,
  staircaseId: z.string(),
  rooms: z.array(RoomSchema),
  activeIssues: z.array(IssueSchema),
  components: z.array(ComponentSchema)
})

export const PropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  areaId: z.string(),
  buildings: z.array(z.string()),
  totalResidences: z.number(),
  occupiedResidences: z.number(),
  constructionYear: z.number(),
  lastRenovation: z.number().optional()
})

export const PropertyListSchema = z.object({
  items: z.array(PropertySchema),
  total: z.number()
})

// Response types
export type PropertyListResponse = z.infer<typeof PropertyListSchema>
export type PropertyResponse = z.infer<typeof PropertySchema>
export type ResidenceResponse = z.infer<typeof ResidenceSchema>
export type ComponentResponse = z.infer<typeof ComponentSchema>
export type RoomResponse = z.infer<typeof RoomSchema>
export type IssueResponse = z.infer<typeof IssueSchema>
export type TenantResponse = z.infer<typeof TenantSchema>
