import { Knex } from 'knex'

export async function clearDb(db: Knex) {
  await db('offer_applicant').del()
  await db('offer').del()
  await db('applicant').del()
  await db('listing').del()
  await db('application_profile_housing_reference').del()
  await db('application_profile').del()
}
