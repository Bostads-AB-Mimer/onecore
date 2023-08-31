/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  await knex('ProjectApartment').insert([
    {
      ApartmentId: '102-008-03-0202/07',
      ProjectCode: 'POCGryta123',
      FirstDayOfMaterialChoice: new Date(),
      LastDayOfMaterialChoice: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        new Date().getDate()
      ),
    },
  ])

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'BADRUM',
        Name: 'Badrum',
        ActionName: 'Välj koncept',
        Type: 'Concept',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      const materialOptionGroupId = result[0].MaterialOptionGroupID
      return knex('MaterialOption')
        .insert([
          {
            MaterialOptionGroupID: materialOptionGroupId,
            Caption: 'Koncept 1',
            ShortDescription: 'Kort beskrivning av koncept 1',
            Description: 'Lång beskrivning av koncept 1',
            CoverImage: 'bad_koncept1.png',
          },
          {
            MaterialOptionGroupID: materialOptionGroupId,
            Caption: 'Koncept 2',
            ShortDescription: 'Kort beskrivning av koncept 2',
            Description: 'Lång beskrivning av koncept 2',
            CoverImage: 'kok_koncept2.png',
          },
        ])
        .returning('MaterialOptionID')
        .then((result) => {
          const materialOptionId = result[0].MaterialOptionID
          return knex('MaterialOptionImage').insert([
            {
              MaterialOptionId: materialOptionId,
              Image: 'kok_koncept1_2.png',
            },
            {
              MaterialOptionId: materialOptionId,
              Image: 'kok_koncept1_3.png',
            },
          ])
        })
    })

  // await knex('Lease').insert([
  //   {
  //     LeaseId: '102-008-03-0202/07',
  //     RentalPropertyId: '102-008-03-0202',
  //     LeaseNumber: '',
  //     LeaseStartDate: '2010-12-01',
  //     LeaseEndDate: null,
  //     Status: 0,
  //     Type: 'Bostadskontrakt',
  //   },
  // ])

  // await knex('Contact').insert([
  //   {
  //     ContactId: 'P965338',
  //     LeaseID: '102-008-03-0202/07',
  //     FirstName: 'Maj-Britt',
  //     LastName: 'Lundberg',
  //     FullName: 'Maj-Britt Lundberg',
  //     Type: 'Kontraktsinnehavare',
  //     NationalRegistrationNumber: '194808075577',
  //     BirthDate: '19480807',
  //     Street: 'Gatvägen',
  //     StreetNumber: '56',
  //     PostalCode: '72266',
  //     City: 'Västerås',
  //     Country: 'Sweden',
  //     MobilePhone: '+460759429414',
  //     PhoneNumber: '+465292643751',
  //     EmailAddress: 'majbritt-123@mimer.nu',
  //   },
  //   {
  //     ContactId: 'P965339',
  //     LeaseID: '102-008-03-0202/07',
  //     FirstName: 'Erik',
  //     LastName: 'Lundberg',
  //     FullName: 'Erik Lundberg',
  //     Type: 'Kontraktsinnehavare',
  //     NationalRegistrationNumber: '194512121122',
  //     BirthDate: '19451212',
  //     Street: 'Gatvägen',
  //     StreetNumber: '56',
  //     PostalCode: '72266',
  //     City: 'Västerås',
  //     Country: 'Sweden',
  //     MobilePhone: '+460759429414',
  //     PhoneNumber: '+465292643751',
  //     EmailAddress: 'erik.lundberg@mimer.nu',
  //   },
  // ])
}
