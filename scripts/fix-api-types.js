#!/usr/bin/env node

/**
 * Post-processing script to fix circular type references in generated API types
 *
 * The openapi-typescript generator sometimes creates circular references like:
 * previousLoan?: components["schemas"]["KeyWithLoanAndEvent"]["loan"] | null;
 * previousLoan?: components["schemas"]["KeyBundleWithLoanStatusResponse"]["keys"]["items"]["loan"] | null;
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
  let fixed = false

  // Pattern 1: KeyWithLoanAndEvent circular reference
  const pattern1 = /previousLoan\?:\s*components\["schemas"\]\["KeyWithLoanAndEvent"\]\["loan"\]\s*\|\s*null;/g
  if (pattern1.test(content)) {
    content = content.replace(
      pattern1,
      `previousLoan?: components["schemas"]["KeyLoan"] | null;`
    )
    fixed = true
  }

  // Pattern 2: KeyBundleWithLoanStatusResponse circular reference
  const pattern2 = /previousLoan\?:\s*components\["schemas"\]\["KeyBundleWithLoanStatusResponse"\]\["keys"\]\["items"\]\["loan"\]\s*\|\s*null;/g
  if (pattern2.test(content)) {
    content = content.replace(
      pattern2,
      `previousLoan?: components["schemas"]["KeyLoan"] | null;`
    )
    fixed = true
  }

  if (fixed) {
    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✅ Fixed circular reference in ${filePath}`)
  } else {
    console.log(`ℹ️  No circular reference found in ${filePath}`)
  }
}

console.log('🔧 Fixing circular type references in generated API types...\n')

filesToFix.forEach(fixApiTypes)

console.log('\n✨ Done!')
