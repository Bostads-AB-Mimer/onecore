/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  await knex('Tenant').del()

  await knex('Lease').del()
  await knex('Lease').insert([
    {
      LeaseId: 'L81178',
      LeaseNumber: '1264',
      LeaseStartDate: '2019-06-08',
      LeaseEndDate: '2035-06-08',
      Status: 'Active',
      ApartmentId: 'A9911156',
    },
    {
      LeaseId: 'L55139',
      LeaseNumber: '5144',
      LeaseStartDate: '2017-01-01',
      LeaseEndDate: '2024-12-31',
      Status: 'Active',
      ApartmentId: 'A1981131',
    },
    {
      LeaseId: 'L24975',
      LeaseNumber: '5118',
      LeaseStartDate: '1995-04-01',
      LeaseEndDate: '2036-08-31',
      Status: 'Active',
      ApartmentId: 'A3361124',
    },
  ])

  await knex('Person').del()
  await knex('Person').insert([
    {
      PersonId: 'P738',
      FirstName: 'Maj-Britt',
      LastName: 'Lundberg',
      NationalRegistrationNumber: '19480807-5577',
      BirthDate: '19480807',
      Street: 'Gatvägen',
      StreetNumber: '56',
      PostalCode: '72266',
      City: 'Västerås',
      MobilePhone: '+460759429414',
      PhoneNumber: '+465292643751',
      EmailAddress: 'majbritt-123@mimer.nu',
    },
    {
      PersonId: 'P5738',
      FirstName: 'Sofie',
      LastName: 'Lindström',
      NationalRegistrationNumber: '20130425-5048',
      BirthDate: '20130425',
      Street: 'Gatvägen',
      StreetNumber: '56',
      PostalCode: '72266',
      City: 'Västerås',
      MobilePhone: '+460221068332',
      PhoneNumber: '+468064133965',
      EmailAddress: 'sofie-test@mimer.nu',
    },
    {
      PersonId: 'P6274',
      FirstName: 'Tobias',
      LastName: 'Åström',
      NationalRegistrationNumber: '19080305-4382',
      BirthDate: '19080305',
      Street: 'Hemstigen',
      StreetNumber: '56',
      PostalCode: '72446',
      City: 'Västerås',
      MobilePhone: '+464673838178',
      PhoneNumber: '+466225423325',
      EmailAddress: 'tobias-test@mimer.nu',
    },
    {
      PersonId: 'P8944',
      FirstName: 'Klara',
      LastName: 'Lundström',
      NationalRegistrationNumber: '19940303-4864',
      BirthDate: '19940303',
      Street: 'Skogsvägen',
      StreetNumber: '20',
      PostalCode: '72303',
      City: 'Västerås',
      MobilePhone: '+460080979405',
      PhoneNumber: '+463613132670',
      EmailAddress: 'klara-test@mimer.nu',
    },
    {
      PersonId: 'P3011',
      FirstName: 'Jonathan',
      LastName: 'Martinsson',
      NationalRegistrationNumber: '19860911-4940',
      BirthDate: '198660911',
      Street: 'Skogsvägen',
      StreetNumber: '20',
      PostalCode: '72303',
      City: 'Västerås',
      MobilePhone: '+468945856929',
      PhoneNumber: '+467774692686',
      EmailAddress: 'jonathan-test@mimer.nu',
    },
  ])

  await knex('Tenant').insert([
    {
      TenantLeaseId: 'L81178',
      TenantPersonId: 'P738',
    },
    {
      TenantLeaseId: 'L81178',
      TenantPersonId: 'P5738',
    },
    {
      TenantLeaseId: 'L55139',
      TenantPersonId: 'P6274',
    },
    {
      TenantLeaseId: 'L24975',
      TenantPersonId: 'P8944',
    },
    {
      TenantLeaseId: 'L24975',
      TenantPersonId: 'P3011',
    },
  ])
}
