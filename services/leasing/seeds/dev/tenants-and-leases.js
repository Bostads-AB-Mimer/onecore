/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  await knex('Lease').insert([
    {
      LeaseId: '102-008-03-0202/07',
      RentalPropertyId: '102-008-03-0202',
      LeaseNumber: '',
      LeaseStartDate: '2010-12-01',
      LeaseEndDate: null,
      Status: 0,
      Type: 'Bostadskontrakt',
    },
  ])

  await knex('Contact').insert([
    {
      ContactId: 'P965338',
      LeaseID: '102-008-03-0202/07',
      FirstName: 'Maj-Britt',
      LastName: 'Lundberg',
      FullName: 'Maj-Britt Lundberg',
      Type: 'Kontraktsinnehavare',
      NationalRegistrationNumber: '194808075577',
      BirthDate: '19480807',
      Street: 'Gatvägen',
      StreetNumber: '56',
      PostalCode: '72266',
      City: 'Västerås',
      Country: 'Sweden',
      MobilePhone: '+460759429414',
      PhoneNumber: '+465292643751',
      EmailAddress: 'majbritt-123@mimer.nu',
    },
    {
      ContactId: 'P965339',
      LeaseID: '102-008-03-0202/07',
      FirstName: 'Erik',
      LastName: 'Lundberg',
      FullName: 'Erik Lundberg',
      Type: 'Kontraktsinnehavare',
      NationalRegistrationNumber: '194512121122',
      BirthDate: '19451212',
      Street: 'Gatvägen',
      StreetNumber: '56',
      PostalCode: '72266',
      City: 'Västerås',
      Country: 'Sweden',
      MobilePhone: '+460759429414',
      PhoneNumber: '+465292643751',
      EmailAddress: 'erik.lundberg@mimer.nu',
    },
  ])
}
