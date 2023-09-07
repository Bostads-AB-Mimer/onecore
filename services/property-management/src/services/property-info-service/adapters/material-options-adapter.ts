import {
  MaterialChoice,
  MaterialOption,
  MaterialOptionGroup,
  // RentalProperty,
  RoomType,
} from '../../../common/types'

import knex from 'knex'
import config from '../../../common/config'
import { getRentalProperty } from './contech-os-adapter'

const db = knex({
  client: 'mssql',
  connection: config.database,
})

const cancelPreviousChoice = async (
  newChoices: Array<string>,
  aparmentId: string
) => {
  await db('MaterialChoice')
    .where({
      'MaterialChoice.ApartmentId': aparmentId,
    })
    .whereNull('MaterialChoice.DateOfCancellation')
    .then((allChoices) => {
      const selectionToUpdate = allChoices.filter(
        (row) => !newChoices.find((choice) => choice == row.MaterialChoiceId)
      )

      selectionToUpdate.forEach((row) => {
        db('MaterialChoice')
          .where({
            'MaterialChoice.MaterialChoiceId': row.MaterialChoiceId,
          })
          .update({ DateOfCancellation: new Date() })
          .catch((error) => console.log(error))
        // .then((result) => {
        //   console.log('row.MaterialChoiced', row.MaterialChoiceId)
        //   console.log('result', result)
        // })
      })

      // console.log('selection result', selectionToUpdate)
      // console.log('selection result count', selectionToUpdate.length)
    })
  // .whereNotIn('MaterialChoice.MaterialChoiceId', newChoices) //doesn't work
}

/* TODO: execute in transaction */
const saveMaterialChoices = async (
  rentalPropertyId: string,
  materialChoices: Array<MaterialChoice>
) => {
  let responseData
  await db('MaterialChoice')
    .insert(
      materialChoices.map((materialChoice: MaterialChoice) => {
        return {
          MaterialOptionId: materialChoice.materialOptionId,
          RoomType: materialChoice.roomTypeId,
          ApartmentId: materialChoice.apartmentId,
          Status: 'Submitted',
          DateOfSubmission: new Date(),
        }
      }),
      'MaterialChoiceId'
    )
    .then((result) => {
      responseData = result

      cancelPreviousChoice(
        result.map((row) => row.MaterialChoiceId),
        rentalPropertyId
      )
    })
    .catch((error) => {
      console.error(error)
    })

  return responseData
}

const getMaterialOption = async (
  rentalPropertyId: string,
  materialOptionId: string
) => {
  const rows = await db('MaterialOptionGroup')
    .innerJoin(
      'MaterialOption',
      'MaterialOption.MaterialOptionGroupId',
      'MaterialOptionGroup.MaterialOptionGroupId'
    )
    .leftJoin(
      'MaterialOptionImage',
      'MaterialOptionImage.MaterialOptionId',
      'MaterialOption.MaterialOptionId'
    )
    .where({
      'MaterialOption.MaterialOptionId': materialOptionId,
    })
    .orderBy(
      'MaterialOption.MaterialOptionGroupId',
      'MaterialOption.MaterialOptionId'
    )

  // console.log('rows', rows)

  let currentMaterialOption: MaterialOption | undefined = undefined

  if (rows && rows.length > 0) {
    rows.forEach((row) => {
      const materialOptionId = row.MaterialOptionId[0]

      if (
        !currentMaterialOption ||
        currentMaterialOption.materialOptionId != materialOptionId
      ) {
        currentMaterialOption = {
          materialOptionId: materialOptionId,
          caption: row.Caption,
          shortDescription: row.ShortDescription,
          description: row.Description,
          coverImage: row.CoverImage,
          materialOptionGroupName: row.Name,
          images: new Array<string>(),
        }
      }

      if (row.Image) {
        currentMaterialOption.images?.push(row.Image)
      }
    })
  }
  return currentMaterialOption
}

const getMaterialOptionGroupsByRoomType = async (
  roomTypeId: string
): Promise<Array<MaterialOptionGroup>> => {
  console.log(
    'getMaterialOptionGroupsByRoomType',
    getMaterialOptionGroupsByRoomType
  )
  const rows = await db('MaterialOptionGroup')
    .innerJoin(
      'MaterialOption',
      'MaterialOption.MaterialOptionGroupId',
      'MaterialOptionGroup.MaterialOptionGroupId'
    )
    .leftJoin(
      'MaterialOptionImage',
      'MaterialOptionImage.MaterialOptionId',
      'MaterialOption.MaterialOptionId'
    )
    .where({
      RoomType: roomTypeId,
    })
    .orderBy(
      'MaterialOption.MaterialOptionGroupId',
      'MaterialOption.MaterialOptionId'
    )

  const materialOptionGroups = new Array<MaterialOptionGroup>()

  if (rows && rows.length > 0) {
    let currentMaterialOptionGroup: MaterialOptionGroup | undefined = undefined
    let currentMaterialOption: MaterialOption | undefined = undefined

    rows.forEach((row) => {
      const materialOptionGroupId = row.MaterialOptionGroupId[0]
      const materialOptionId = row.MaterialOptionId[0]

      // console.log('materialOptionGroups', materialOptionGroups)
      // console.log(
      //   'currentMaterialOptionGroup',
      //   currentMaterialOptionGroup?.materialOptionGroupId
      // )
      // console.log('materialOptionGroupId', materialOptionGroupId)

      if (
        !currentMaterialOptionGroup ||
        currentMaterialOptionGroup.materialOptionGroupId !=
          materialOptionGroupId
      ) {
        currentMaterialOptionGroup = {
          materialOptionGroupId: materialOptionGroupId,
          roomTypeId: row.RoomType,
          name: row.Name,
          actionName: row.ActionName,
          materialOptions: new Array<MaterialOption>(),
          type: row.Type,
        }

        materialOptionGroups.push(currentMaterialOptionGroup)
      }

      if (
        !currentMaterialOption ||
        currentMaterialOption.materialOptionId != materialOptionId
      ) {
        currentMaterialOption = {
          materialOptionId: materialOptionId,
          caption: row.Caption,
          shortDescription: row.ShortDescription,
          description: row.Description,
          coverImage: row.CoverImage,
          materialOptionGroupName: currentMaterialOptionGroup.name,
          images: new Array<string>(),
        }

        currentMaterialOptionGroup.materialOptions?.push(currentMaterialOption)
      }

      if (row.Image) {
        currentMaterialOption.images?.push(row.Image)
      }
    })
  }
  // console.log('materialOptionGroups', materialOptionGroups)
  materialOptionGroups.forEach((materialOptionGroup: MaterialOptionGroup) => {
    materialOptionGroup.materialOptions?.sort((a, b) => {
      return a.caption > b.caption ? 1 : -1
    })
  })
  return materialOptionGroups
}
/*const materialOptionGroups = new Array<MaterialOptionGroup>()

  materialOptionGroups.push({
    materialOptionGroupId: '1',
    roomTypeId: '1',
    type: 'Concept',
    actionName: 'Välj koncept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Koncept 1',
        coverImage: 'kok_koncept1.png',
        description:
          'I det första alternativet får du ett vitt och ljust kök med en betonggrå bänkskiva och ett matchande linoleumgolv. Ovanför diskbänken sitter ett vitt blankt kakel i formatet 15x15 centimeter.',
        images: ['kok_koncept1_2.png', 'kok_koncept1_3.png'],
      },
      {
        materialOptionId: '2',
        caption: 'Koncept 2',
        coverImage: 'kok_koncept2.png',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '2',
    roomTypeId: '1',
    type: 'AddOn',
    actionName: 'Tillval',
    materialOptions: [
      {
        materialOptionId: '3',
        caption: 'Diskmaskin',
        shortDescription: '+215 kr/mån',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '3',
    roomTypeId: '2',
    type: 'Concept',
    actionName: 'Välj koncept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Koncept 1',
        coverImage: 'bad_koncept1.png',
      },
      {
        materialOptionId: '2',
        caption: 'Koncept 2',
        coverImage: 'bad_koncept1.png',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '4',
    roomTypeId: '2',
    actionName: 'Välj mellan följande',
    type: 'SingleChoice',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Dusch',
      },
      {
        materialOptionId: '2',
        caption: 'Badkar',
        shortDescription:
          'Vid val av badkar är det ej möjligt att välja till tvätt-/kombi-maskin.',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '5',
    roomTypeId: '2',
    actionName: 'Tillval',
    type: 'AddOn',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Tvättmaskin',
        shortDescription: '+265kr/mån',
      },
      {
        materialOptionId: '2',
        caption: 'Kombimaskin',
        shortDescription: '+273kr/mån',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '6',
    roomTypeId: '3',
    name: 'Golv',
    type: 'Concept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Ekparkett ingår',
        coverImage: 'golv_ekparkett.jpg',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '7',
    roomTypeId: '3',
    name: 'Väggar',
    actionName: 'Välj väggfärg',
    type: 'Concept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Ljusgrå',
        shortDescription: '10002Y',
        coverImage: 'vagg_ljusgra.png',
      },
      {
        materialOptionId: '2',
        caption: 'Varmvit',
        shortDescription: '20002Y',
        coverImage: 'vagg_varmvit.png',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '8',
    roomTypeId: '4',
    name: 'Golv',
    actionName: 'Välj golv',
    type: 'Concept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Ljusgrå linoleum',
        coverImage: 'golv_ljusgra.png',
      },
      {
        materialOptionId: '2',
        caption: 'Beige linoleum',
        coverImage: 'golv_beige.png',
      },
    ],
  })

  materialOptionGroups.push({
    materialOptionGroupId: '8',
    roomTypeId: '34',
    name: 'Väggar',
    actionName: 'Välj väggar',
    type: 'Concept',
    materialOptions: [
      {
        materialOptionId: '1',
        caption: 'Ljusgrå',
        shortDescription: '10002Y',
        coverImage: 'vagg_ljusgra.png',
      },
      {
        materialOptionId: '2',
        caption: 'Varmvit',
        shortDescription: '20002Y',
        coverImage: 'vagg_varmvit.png',
      },
    ],
  })

  return materialOptionGroups.filter(
    (materialOptionGroup: MaterialOptionGroup) =>
      materialOptionGroup.roomTypeId == roomTypeId
  )
}*/

const getRoomTypeWithMaterialOptions = async (
  apartmentId: string,
  roomTypes: RoomType[]
) => {
  for (const roomType of roomTypes) {
    roomType.materialOptionGroups = await getMaterialOptionGroupsByRoomType(
      roomType.roomTypeId
    )
  }

  return roomTypes
}

const getMaterialOptionGroup = async (
  roomTypeId: string,
  materialOptionGroupId: string
): Promise<MaterialOptionGroup | undefined> => {
  let groups = await getMaterialOptionGroupsByRoomType(roomTypeId)

  return groups.find(
    (materialOptionGroup: MaterialOptionGroup) =>
      materialOptionGroup.materialOptionGroupId == materialOptionGroupId
  )
}

// const getMaterialOption = async (
//   roomTypeId: string,
//   materialOptionGroupId: string,
//   materialOptionId: string
// ): Promise<MaterialOption | undefined> => {
//   let materialOption: MaterialOption | undefined
//   let groups = await getMaterialOptionGroupsByRoomType(roomTypeId)

//   groups
//     .filter(
//       (group: MaterialOptionGroup) =>
//         group.materialOptionGroupId == materialOptionGroupId
//     )
//     .forEach((group: MaterialOptionGroup) => {
//       materialOption = group.materialOptions?.find(
//         (option: MaterialOption) => option.materialOptionId == materialOptionId
//       )
//     })

//   return materialOption
// }

// /*TODO get real material options */
// const getMaterialOptionGroups = async (
//   roomTypeId: string
// ): Promise<Array<MaterialOptionGroup>> => {
//   return getMaterialOptionGroupsByRoomType(roomTypeId)
//   // const materialOptionGroups = new Array<MaterialOptionGroup>()

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '1',
//   //   roomTypeId: '1',
//   //   type: 'Concept',
//   //   actionName: 'Välj koncept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Koncept 1',
//   //       coverImage: 'kok_koncept1.png',
//   //       description:
//   //         'I det första alternativet får du ett vitt och ljust kök med en betonggrå bänkskiva och ett matchande linoleumgolv. Ovanför diskbänken sitter ett vitt blankt kakel i formatet 15x15 centimeter.',
//   //       images: ['kok_koncept1_2.png', 'kok_koncept1_3.png'],
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Koncept 2',
//   //       coverImage: 'kok_koncept2.png',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '2',
//   //   roomTypeId: '1',
//   //   type: 'AddOn',
//   //   actionName: 'Tillval',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '3',
//   //       caption: 'Diskmaskin',
//   //       shortDescription: '+215 kr/mån',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '3',
//   //   roomTypeId: '2',
//   //   type: 'Concept',
//   //   actionName: 'Välj koncept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Koncept 1',
//   //       coverImage: 'bad_koncept1.png',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Koncept 2',
//   //       coverImage: 'bad_koncept1.png',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '4',
//   //   roomTypeId: '2',
//   //   actionName: 'Välj mellan följande',
//   //   type: 'SingleChoice',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Dusch',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Badkar',
//   //       shortDescription:
//   //         'Vid val av badkar är det ej möjligt att välja till tvätt-/kombi-maskin.',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '5',
//   //   roomTypeId: '2',
//   //   actionName: 'Tillval',
//   //   type: 'AddOn',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Tvättmaskin',
//   //       shortDescription: '+265kr/mån',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Kombimaskin',
//   //       shortDescription: '+273kr/mån',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '6',
//   //   roomTypeId: '3',
//   //   name: 'Golv',
//   //   type: 'Concept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Ekparkett ingår',
//   //       coverImage: 'golv_ekparkett.jpg',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '7',
//   //   roomTypeId: '3',
//   //   name: 'Väggar',
//   //   actionName: 'Välj väggfärg',
//   //   type: 'Concept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Ljusgrå',
//   //       shortDescription: '10002Y',
//   //       coverImage: 'vagg_ljusgra.png',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Varmvit',
//   //       shortDescription: '20002Y',
//   //       coverImage: 'vagg_varmvit.png',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '8',
//   //   roomTypeId: '4',
//   //   name: 'Golv',
//   //   actionName: 'Välj golv',
//   //   type: 'Concept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Ljusgrå linoleum',
//   //       coverImage: 'golv_ljusgra.png',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Beige linoleum',
//   //       coverImage: 'golv_beige.png',
//   //     },
//   //   ],
//   // })

//   // materialOptionGroups.push({
//   //   materialOptionGroupId: '8',
//   //   roomTypeId: '34',
//   //   name: 'Väggar',
//   //   actionName: 'Välj väggar',
//   //   type: 'Concept',
//   //   materialOptions: [
//   //     {
//   //       materialOptionId: '1',
//   //       caption: 'Ljusgrå',
//   //       shortDescription: '10002Y',
//   //       coverImage: 'vagg_ljusgra.png',
//   //     },
//   //     {
//   //       materialOptionId: '2',
//   //       caption: 'Varmvit',
//   //       shortDescription: '20002Y',
//   //       coverImage: 'vagg_varmvit.png',
//   //     },
//   //   ],
//   // })

//   // return materialOptionGroups.filter(
//   //   (materialOptionGroup: MaterialOptionGroup) =>
//   //     materialOptionGroup.roomTypeId == roomTypeId
//   // )
// }

const getMaterialChoices = async (
  apartmentId: string,
  roomTypes: RoomType[]
) => {
  for (const roomType of roomTypes) {
    const materialGroups = await getMaterialChoicesForRoom({
      apartmentId: apartmentId,
      roomTypeId: roomType.roomTypeId,
    })
    roomType.materialOptionGroups = materialGroups
  }

  return roomTypes
}

const getMaterialChoicesForRoom = async ({
  apartmentId,
  roomTypeId,
}: {
  apartmentId: string
  roomTypeId: string
}): Promise<Array<MaterialOptionGroup>> => {
  const materialChoices = new Array<MaterialChoice>()

  /*Adds somewhat random material choices */
  materialChoices.push(
    await getMaterialChoice({
      roomTypeId: '1',
      materialOptionGroupId: '1',
      materialOptionId: Math.round(Math.random() * 1 + 1).toString(),
      apartmentId: apartmentId,
    })
  )

  if (Math.round(Math.random()) == 0) {
    materialChoices.push(
      await getMaterialChoice({
        roomTypeId: '1',
        materialOptionGroupId: '2',
        materialOptionId: '3',
        apartmentId: apartmentId,
      })
    )
  }

  materialChoices.push(
    await getMaterialChoice({
      roomTypeId: '2',
      materialOptionGroupId: '3',
      materialOptionId: Math.round(Math.random() + 1).toString(),
      apartmentId: apartmentId,
    })
  )

  materialChoices.push(
    await getMaterialChoice({
      roomTypeId: '2',
      materialOptionGroupId: '4',
      materialOptionId: Math.round(Math.random() + 1).toString(),
      apartmentId: apartmentId,
    })
  )

  if (Math.round(Math.random()) == 0) {
    materialChoices.push(
      await getMaterialChoice({
        roomTypeId: '2',
        materialOptionGroupId: '5',
        materialOptionId: '1',
        apartmentId: apartmentId,
      })
    )
  }

  if (Math.round(Math.random()) == 0) {
    materialChoices.push(
      await getMaterialChoice({
        roomTypeId: '2',
        materialOptionGroupId: '5',
        materialOptionId: '2',
        apartmentId: apartmentId,
      })
    )
  }

  materialChoices.push(
    await getMaterialChoice({
      roomTypeId: '3',
      materialOptionGroupId: '7',
      materialOptionId: Math.round(Math.random() + 1).toString(),
      apartmentId: apartmentId,
    })
  )

  materialChoices.push(
    await getMaterialChoice({
      roomTypeId: '4',
      materialOptionGroupId: '8',
      materialOptionId: Math.round(Math.random() + 1).toString(),
      apartmentId: apartmentId,
    })
  )

  const materialOptionGroups = new Array<MaterialOptionGroup>()

  for (const materialChoice of materialChoices.filter(
    (materialChoice: MaterialChoice) => materialChoice.roomTypeId == roomTypeId
  )) {
    let group = materialOptionGroups.find(
      (materialOptionGroup: MaterialOptionGroup) =>
        materialOptionGroup.materialOptionGroupId ==
        materialChoice.materialOptionGroupId
    )
    if (!group) {
      group = await getMaterialOptionGroup(
        materialChoice.roomTypeId,
        materialChoice.materialOptionGroupId
      )
      if (group) {
        group.materialChoices = new Array<MaterialChoice>()
        materialOptionGroups.push(group)
      }
    }

    if (group) {
      group.materialChoices?.push(materialChoice)
      materialChoice.materialOption = group.materialOptions?.find(
        (materialOption: MaterialOption) =>
          materialOption.materialOptionId == materialChoice.materialOptionId
      )
    }
  }

  return materialOptionGroups
}

const getMaterialChoice = async ({
  roomTypeId,
  materialOptionGroupId,
  materialOptionId,
  apartmentId,
}: {
  roomTypeId: string
  materialOptionGroupId: string
  materialOptionId: string
  apartmentId: string
}): Promise<MaterialChoice> => {
  return {
    materialOptionId: materialOptionId,
    materialOptionGroupId: materialOptionGroupId,
    roomTypeId: roomTypeId,
    apartmentId: apartmentId,
    materialChoiceId: '1',
    status: 'Submitted',
    dateOfSubmission: new Date(),
  }
}

export {
  getRoomTypeWithMaterialOptions,
  // getSingleMaterialOption,
  // getMaterialOptionGroup,
  // getMaterialOptionGroups,
  getMaterialOption,
  getMaterialChoices,
  saveMaterialChoices,
}
