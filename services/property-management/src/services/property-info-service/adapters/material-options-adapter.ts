import {
  MaterialChoice,
  MaterialOption,
  MaterialOptionGroup,
  RoomType,
} from '../../../common/types'

import knex from 'knex'
import config from '../../../common/config'

const db = knex({
  client: 'mssql',
  connection: config.database,
})

const cancelPreviousChoice = async (
  newChoices: Array<string>,
  aparmentId: string
) => {
  console.log('cancel choice')
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
          .update({ DateOfCancellation: new Date(), Status: 'Cancelled' })
          .catch((error) => console.log(error))
      })
    })
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
      return responseData
    })
    .catch((error) => {
      console.error(error)
    })
}

const getMaterialOption = async (materialOptionId: string) => {
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
      'MaterialOptionGroup.MaterialOptionGroupId',
      'MaterialOption.MaterialOptionId'
    )

  const materialOptionGroups = new Array<MaterialOptionGroup>()

  if (rows && rows.length > 0) {
    let currentMaterialOptionGroup: MaterialOptionGroup | undefined = undefined
    let currentMaterialOption: MaterialOption | undefined = undefined

    rows.forEach((row) => {
      const materialOptionGroupId = row.MaterialOptionGroupId[0]
      const materialOptionId = row.MaterialOptionId[0]

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
  materialOptionGroups.forEach((materialOptionGroup: MaterialOptionGroup) => {
    materialOptionGroup.materialOptions?.sort((a, b) => {
      return a.caption > b.caption ? 1 : -1
    })
  })
  return materialOptionGroups
}
const getRoomTypeWithMaterialOptions = async (roomTypes: RoomType[]) => {
  for (const roomType of roomTypes) {
    roomType.materialOptionGroups = await getMaterialOptionGroupsByRoomType(
      roomType.roomTypeId
    )
  }

  return roomTypes.filter(filterRoomTypes).sort(sortRoomTypes)
}
const getMaterialChoices = async (
  apartmentId: string,
  roomTypes: RoomType[]
) => {
  for (const roomType of roomTypes) {
    const materialGroups = await getMaterialChoicesByRoomType({
      apartmentId: apartmentId,
      roomTypeId: roomType.roomTypeId,
    })
    roomType.materialOptionGroups = materialGroups
  }

  return roomTypes.filter(filterRoomTypes).sort(sortRoomTypes)
}

const filterRoomTypes = (roomType: RoomType) => {
  return (
    roomType.materialOptionGroups != undefined &&
    roomType.materialOptionGroups.length > 0
  )
}
const sortRoomTypes = (a: RoomType, b: RoomType) => {
  return a.name > b.name ? 1 : -1
}

const getMaterialChoicesByRoomType = async ({
  apartmentId,
  roomTypeId,
}: {
  apartmentId: string
  roomTypeId: string
}): Promise<Array<MaterialOptionGroup>> => {
  const rows = await db('MaterialOptionGroup')
    .innerJoin(
      'MaterialOption',
      'MaterialOption.MaterialOptionGroupId',
      'MaterialOptionGroup.MaterialOptionGroupId'
    )
    .innerJoin(
      'MaterialChoice',
      'MaterialChoice.MaterialOptionId',
      'MaterialOption.MaterialOptionId'
    )
    .leftJoin(
      'MaterialOptionImage',
      'MaterialOptionImage.MaterialOptionId',
      'MaterialOption.MaterialOptionId'
    )
    .where({
      'MaterialOptionGroup.RoomType': roomTypeId,
      'MaterialChoice.Status': 'Submitted',
    })
    .orderBy(
      'MaterialOption.MaterialOptionGroupId',
      'MaterialChoice.MaterialChoiceId',
      'MaterialOption.MaterialOptionId'
    )

  const materialOptionGroups = new Array<MaterialOptionGroup>()

  if (rows && rows.length > 0) {
    let currentMaterialOptionGroup: MaterialOptionGroup | undefined = undefined
    let currentMaterialOption: MaterialOption | undefined = undefined
    let currentMaterialChoice: MaterialChoice | undefined = undefined

    rows.forEach((row) => {
      const materialOptionGroupId = row.MaterialOptionGroupId[0]
      const materialOptionId = row.MaterialOptionId[0]
      const materialChoiceId = row.MaterialChoiceId

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
          materialChoices: new Array<MaterialChoice>(),
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

      if (
        !currentMaterialChoice ||
        currentMaterialChoice.materialChoiceId != materialChoiceId
      ) {
        currentMaterialChoice = {
          materialChoiceId: materialChoiceId,
          materialOptionId: materialOptionId,
          materialOptionGroupId: materialOptionGroupId,
          apartmentId: apartmentId,
          roomTypeId: row.RoomType,
          status: row.Status,
        }

        currentMaterialOptionGroup.materialChoices?.push(currentMaterialChoice)
      }
    })
  }

  materialOptionGroups.forEach((materialOptionGroup: MaterialOptionGroup) => {
    materialOptionGroup.materialOptions?.sort((a, b) => {
      return a.caption > b.caption ? 1 : -1
    })
  })

  return materialOptionGroups
}

export {
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  saveMaterialChoices,
}
