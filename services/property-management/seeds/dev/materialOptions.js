/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  await knex('MaterialChoice').del()
  await knex('MaterialOptionImage').del()
  await knex('MaterialOption').del()
  await knex('MaterialOptionGroup').del()
  await knex('ProjectApartment').del()
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
        RoomType: 'KÖK',
        // Name: 'Kök & Hall',
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
            CoverImage: 'kok_koncept1.png',
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
          const materialOptionId1 = result[0].MaterialOptionID
          const materialOptionId2 = result[1].MaterialOptionID

          knex('MaterialChoice')
            .insert([
              {
                MaterialChoiceId: '1',
                MaterialOptionId: materialOptionId1,
                ApartmentId: '102-008-03-0202/07',
                RoomType: 'KÖK',
                Status: 'Submitted',
                DateOfSubmission: new Date(),
                DateOfCancellation: null,
              },
            ])
            .then(() => {
              return knex('MaterialOptionImage').insert([
                {
                  MaterialOptionId: materialOptionId1,
                  Image: 'kok_koncept1_2.png',
                },
                {
                  MaterialOptionId: materialOptionId1,
                  Image: 'kok_koncept1_3.png',
                },
                {
                  MaterialOptionId: materialOptionId2,
                  Image: 'kok_koncept1_3.png',
                },
              ])
            })
        })
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'BADRUM',
        // Name: 'Badrum',
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

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'BADRUM',
        Name: 'Badrum',
        ActionName: 'Välj mellan följande',
        Type: 'SingleChoice',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      const materialOptionGroupId = result[0].MaterialOptionGroupID
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: materialOptionGroupId,
          Caption: 'Dusch',
        },
        {
          MaterialOptionGroupID: materialOptionGroupId,
          Caption: 'Badkar',
          ShortDescription:
            'Vid val av badkar är det ej möjligt att lägga till tvätt-/kombimaskin',
        },
      ])
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'BADRUM',
        Name: 'Badrum',
        ActionName: 'Tillval',
        Type: 'AddOn',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      const materialOptionGroupId = result[0].MaterialOptionGroupID
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: materialOptionGroupId,
          Caption: 'Tvättmaskin',
          ShortDescription: '+265 kr/mån',
        },
        {
          MaterialOptionGroupID: materialOptionGroupId,
          Caption: 'Kombimaskin',
          ShortDescription: '+273 kr/mån',
        },
      ])
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'VARDAGSRUM',
        Name: 'Golv',
        // ActionName: 'Välj koncept',
        Type: 'Concept',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Ekparkett ingår',
          CoverImage: 'golv_ekparkett.jpg',
        },
      ])
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'VARDAGSRUM',
        Name: 'Väggar',
        ActionName: 'Välj väggfärg',
        Type: 'Concept',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Ljusgrå',
          ShortDescription: '10002Y',
          CoverImage: 'vagg_ljusgra.png',
        },
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Varmvit',
          ShortDescription: '20002Y',
          CoverImage: 'vagg_varmvit.png',
        },
      ])
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'RUM 1',
        Name: 'Golv',
        ActionName: 'Välj golv',
        Type: 'Concept',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Ljusgrå linoleum',
          CoverImage: 'golv_ljusgra.png',
        },
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Beige linoleum',
          CoverImage: 'golv_beige.png',
        },
      ])
    })

  await knex('MaterialOptionGroup')
    .insert([
      {
        RoomType: 'RUM 1',
        Name: 'Väggar',
        ActionName: 'Välj väggar',
        Type: 'Concept',
      },
    ])
    .returning('MaterialOptionGroupID')
    .then((result) => {
      return knex('MaterialOption').insert([
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Ljusgrå',
          ShortDescription: '10002Y',
          CoverImage: 'vagg_ljusgra.png',
        },
        {
          MaterialOptionGroupID: result[0].MaterialOptionGroupID,
          Caption: 'Varmvit',
          ShortDescription: '20002Y',
          CoverImage: 'vagg_varmvit.png',
        },
      ])
    })
}
