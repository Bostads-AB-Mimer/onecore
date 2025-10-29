/**
 * Data migration to populate junction tables from existing JSON arrays.
 *
 * This migration:
 * 1. Reads key_loans.keys JSON arrays and inserts into key_loan_items
 * 2. Reads key_events.keys JSON arrays and inserts into key_event_items
 * 3. Keeps original JSON columns intact (for rollback safety)
 *
 * IMPORTANT: This is a one-way data migration. The down() function will
 * clear junction tables but NOT restore JSON arrays (they're preserved).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = async function (knex) {
  console.log('Starting data migration to junction tables...')

  // Migrate key_loans.keys to key_loan_items
  console.log('Migrating key_loans.keys to key_loan_items...')
  const keyLoans = await knex('key_loans').select('id', 'keys')

  let loanItemsInserted = 0
  let loansDeduplicated = 0
  for (const loan of keyLoans) {
    try {
      // Parse JSON array
      const keyIds = JSON.parse(loan.keys || '[]')

      if (keyIds.length > 0) {
        // Remove duplicates using Set (handles data quality issues)
        const uniqueKeyIds = [...new Set(keyIds)]

        if (uniqueKeyIds.length < keyIds.length) {
          loansDeduplicated++
          console.log(`  Loan ${loan.id}: removed ${keyIds.length - uniqueKeyIds.length} duplicate key(s)`)
        }

        // Insert into junction table
        const items = uniqueKeyIds.map(keyId => ({
          id: knex.raw('NEWID()'),
          keyLoanId: loan.id,
          keyId: keyId,
          createdAt: knex.fn.now()
        }))

        await knex('key_loan_items').insert(items)
        loanItemsInserted += items.length
      }
    } catch (error) {
      console.error(`Error migrating loan ${loan.id}:`, error.message)
      // Continue with other loans even if one fails
    }
  }

  if (loansDeduplicated > 0) {
    console.log(`WARNING: Deduplicated keys in ${loansDeduplicated} loans`)
  }

  console.log(`Inserted ${loanItemsInserted} key_loan_items from ${keyLoans.length} loans`)

  // Migrate key_events.keys to key_event_items
  console.log('Migrating key_events.keys to key_event_items...')
  const keyEvents = await knex('key_events').select('id', 'keys')

  let eventItemsInserted = 0
  let eventsDeduplicated = 0
  for (const event of keyEvents) {
    try {
      // Parse JSON array
      const keyIds = JSON.parse(event.keys || '[]')

      if (keyIds.length > 0) {
        // Remove duplicates using Set (handles data quality issues)
        const uniqueKeyIds = [...new Set(keyIds)]

        if (uniqueKeyIds.length < keyIds.length) {
          eventsDeduplicated++
          console.log(`  Event ${event.id}: removed ${keyIds.length - uniqueKeyIds.length} duplicate key(s)`)
        }

        // Insert into junction table
        const items = uniqueKeyIds.map(keyId => ({
          id: knex.raw('NEWID()'),
          keyEventId: event.id,
          keyId: keyId,
          createdAt: knex.fn.now()
        }))

        await knex('key_event_items').insert(items)
        eventItemsInserted += items.length
      }
    } catch (error) {
      console.error(`Error migrating event ${event.id}:`, error.message)
      // Continue with other events even if one fails
    }
  }

  if (eventsDeduplicated > 0) {
    console.log(`WARNING: Deduplicated keys in ${eventsDeduplicated} events`)
  }

  console.log(`Inserted ${eventItemsInserted} key_event_items from ${keyEvents.length} events`)
  console.log('Data migration complete!')
}

/**
 * Rollback: Clear junction tables.
 * NOTE: This does NOT restore JSON arrays (they were preserved in up()).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.down = async function (knex) {
  console.log('Rolling back junction table data...')

  await knex('key_event_items').del()
  console.log('Cleared key_event_items')

  await knex('key_loan_items').del()
  console.log('Cleared key_loan_items')

  console.log('Rollback complete. Original JSON arrays are still intact.')
}
