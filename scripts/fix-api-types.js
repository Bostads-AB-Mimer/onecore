#!/usr/bin/env node

/**
 * Post-processing script to fix circular type references in generated API types
 *
 * The openapi-typescript generator sometimes creates circular references like:
 * previousLoan?: components["schemas"]["KeyWithLoanAndEvent"]["loan"] | null;
 *
 * This script replaces those by referencing the KeyLoan schema directly.
 */

const fs = require('fs')
const path = require('path')

const filesToFix = [
  'apps/keys-portal/src/services/api/core/generated/api-types.ts',
  'apps/property-tree/src/services/api/core/generated/api-types.ts',
]

function fixApiTypes(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`)
    return
  }

  let content = fs.readFileSync(fullPath, 'utf-8')

  // Replace the circular reference with a reference to KeyLoan schema
  // This avoids the circular reference while still using the same type
  const circularRefPattern = /previousLoan\?:\s*components\["schemas"\]\["KeyWithLoanAndEvent"\]\["loan"\]\s*\|\s*null;/g

  if (circularRefPattern.test(content)) {
    content = content.replace(
      circularRefPattern,
      `previousLoan?: components["schemas"]["KeyLoan"] | null;`
    )

    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✅ Fixed circular reference in ${filePath}`)
  } else {
    console.log(`ℹ️  No circular reference found in ${filePath}`)
  }
}

console.log('🔧 Fixing circular type references in generated API types...\n')

filesToFix.forEach(fixApiTypes)

console.log('\n✨ Done!')
