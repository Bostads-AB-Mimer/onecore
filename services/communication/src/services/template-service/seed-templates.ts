import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

import { SYSTEM_TEMPLATE_KEYS, SystemTemplate } from './system-templates'

// Seed data the add-system-templates migration inserts. Read here for the
// preview script and tests; the DB stays the source of truth once seeded.
const SEED_DIR = path.join(
  __dirname,
  '../../../migrations/system-email-templates'
)

const SeedIndexSchema = z.array(
  z.object({
    systemKey: z.enum(SYSTEM_TEMPLATE_KEYS),
    name: z.string().min(1),
    subject: z.string().min(1),
  })
)

export type SeedTemplate = SystemTemplate & { name: string }

export const readSeedTemplates = (dir: string = SEED_DIR): SeedTemplate[] =>
  SeedIndexSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
  ).map((entry) => ({
    ...entry,
    body: fs.readFileSync(path.join(dir, `${entry.systemKey}.md`), 'utf8'),
  }))
