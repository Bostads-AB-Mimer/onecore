import * as dotenv from 'dotenv'
import { join } from 'node:path'

dotenv.config({ path: join(__dirname, '../.env.test') })
