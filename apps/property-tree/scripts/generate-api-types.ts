import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const SWAGGER_URL = 'http://localhost:5050/swagger.json'
const OUTPUT_PATH = path.join(process.cwd(), 'src/services/api/generated')

async function generateTypes() {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true })
    }

    // Fetch and save swagger.json
    console.log('Fetching Swagger schema...')
    const swaggerPath = path.join(OUTPUT_PATH, 'swagger.json')
    execSync(`curl -o ${swaggerPath} ${SWAGGER_URL}`)

    // Generate types using openapi-typescript
    console.log('Generating TypeScript types...')
    execSync(
      `npx openapi-typescript ${swaggerPath} --output ${path.join(
        OUTPUT_PATH,
        'api-types.ts'
      )}`
    )

    console.log('Types generated successfully!')
  } catch (error) {
    console.error('Error generating types:', error)
    process.exit(1)
  }
}

generateTypes()
